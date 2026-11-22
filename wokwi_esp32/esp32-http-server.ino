// ==============================================================================
//  HydroMind -- SMART WATER SYSTEM (Wokwi ESP32 Simulation)
//  Water flow sensor (Potentiometer GPIO 34) & Emergency valve (Servo GPIO 18)
//  Connects to PHP/MySQL backend on XAMPP via plain HTTP through ngrok tunnel
// ==============================================================================

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClient.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>

// -- Configuration Block -----------------------------------------------------
#define USE_LOCAL_GATEWAY 0

const char* SERVER_URL_NGROK = "http://earphone-baffle-prone.ngrok-free.dev/kizuna_water/recevoir_donnees.php";
const char* SERVER_URL_LOCAL = "http://host.wokwi.internal/kizuna_water/recevoir_donnees.php"; // Wokwi for VS Code private gateway

#if USE_LOCAL_GATEWAY
const char* SERVER_URL = SERVER_URL_LOCAL;
#else
const char* SERVER_URL = SERVER_URL_NGROK;
#endif

// Transmission interval: one reading every 1500 ms
const unsigned long SEND_INTERVAL_MS = 1500;

// -- Hardware Pins (diagram.json) --------------------------------------------
#define POT_PIN    34   // Potentiometer simulating water flow sensor
#define SERVO_PIN  18   // Servo simulating emergency shutoff valve

// -- Wi-Fi Parameters --------------------------------------------------------
const char* WIFI_SSID     = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";

// -- Flow & Servo Settings ---------------------------------------------------
const float DEBIT_MAX     = 15.0; // 0.0 L/min (min) to 15.0 L/min (max)
const int   ANGLE_OUVERTE = 0;    // 0 deg  = Valve OPEN
const int   ANGLE_FERMEE  = 90;   // 90 deg = Valve CLOSED

// -- State Variables ---------------------------------------------------------
Servo         vanne;
int           dernierAngle = -1;
unsigned long dernierEnvoi = 0;

// ==============================================================================
//  WI-FI: initial connection and auto-reconnect
// ==============================================================================
void verifierConnexionWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.println("\n[WiFi] Connecting to Wokwi-GUEST...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD, 6);   // channel 6 = Wokwi's virtual access point
  int tentatives = 0;
  while (WiFi.status() != WL_CONNECTED && tentatives < 60) {
    delay(250);
    Serial.print(".");
    tentatives++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected!");
    Serial.print("  IP   : "); Serial.println(WiFi.localIP());
    Serial.print("  RSSI : "); Serial.print(WiFi.RSSI()); Serial.println(" dBm");
  } else {
    Serial.println("\n[WiFi] FAILED -- will retry next cycle.");
  }
}

// ==============================================================================
//  SERVO: valve positioning
// ==============================================================================
void positionnerAngleVanne(int angleCible) {
  if (angleCible < 0) angleCible = 0;
  if (angleCible > 90) angleCible = 90;
  vanne.write(angleCible);
  dernierAngle = angleCible;
}

void positionnerVanne(bool ouvrir) {
  positionnerAngleVanne(ouvrir ? ANGLE_OUVERTE : ANGLE_FERMEE);
}

// ==============================================================================
//  SERVER RESPONSE PARSING: decode JSON, update valve & print state
// ==============================================================================
void traiterReponseServeur(const String& payload, float measuredFlow) {
  String statutVanne   = "";
  String etatAlerte    = "NORMAL";
  String typeAlerte    = "NONE";
  String regime        = "NORMAL";
  int    ouverturePct  = 100;
  float  debitEau      = measuredFlow;
  float  debitBrut     = measuredFlow;
  float  debitEvite    = 0.0;
  bool   modeNuit      = false;

  #if ARDUINOJSON_VERSION_MAJOR >= 7
    JsonDocument doc;
  #else
    StaticJsonDocument<2048> doc;
  #endif

  DeserializationError err = deserializeJson(doc, payload);

  if (!err) {
    if (doc["statut_vanne"].is<const char*>()) {
      statutVanne = doc["statut_vanne"].as<String>();
    }
    if (doc["etat_alerte"].is<const char*>()) {
      etatAlerte = doc["etat_alerte"].as<String>();
    }
    if (doc["type_alerte"].is<const char*>()) {
      typeAlerte = doc["type_alerte"].as<String>();
    }
    if (doc["regime"].is<const char*>()) {
      regime = doc["regime"].as<String>();
    }
    if (doc["ouverture_pct"].is<int>()) {
      ouverturePct = doc["ouverture_pct"].as<int>();
    }
    if (doc["debit_eau"].is<float>()) {
      debitEau = doc["debit_eau"].as<float>();
    }
    if (doc["debit_brut"].is<float>()) {
      debitBrut = doc["debit_brut"].as<float>();
    }
    if (doc["debit_evite"].is<float>()) {
      debitEvite = doc["debit_evite"].as<float>();
    }
    if (doc["mode_nuit"].is<bool>()) {
      modeNuit = doc["mode_nuit"].as<bool>();
    }
  } else {
    // Text fallback if JSON parsing fails
    if (payload.indexOf("\"statut_vanne\":\"FERMEE\"") != -1) {
      statutVanne = "FERMEE";
    } else if (payload.indexOf("\"statut_vanne\":\"OUVERTE\"") != -1) {
      statutVanne = "OUVERTE";
    }
    if (payload.indexOf("\"etat_alerte\":\"FERMEE\"") != -1) {
      etatAlerte = "FERMEE";
    } else if (payload.indexOf("\"etat_alerte\":\"ALERTE\"") != -1) {
      etatAlerte = "ALERTE";
    }
    if (payload.indexOf("\"regime\":\"ECO_NUIT\"") != -1) {
      regime = "ECO_NUIT";
    } else if (payload.indexOf("\"regime\":\"EVENEMENT\"") != -1) {
      regime = "EVENEMENT";
    }
  }

  // Servo angle calculation:
  // round((100 - pct) * 0.9) (100% -> 0 deg, 50% -> 45 deg, 0% -> 90 deg); FERMEE forces 90 deg
  int angleCible;
  if (statutVanne == "FERMEE") {
    angleCible = 90;
    ouverturePct = 0;
  } else {
    angleCible = (int) round((100.0f - (float) ouverturePct) * 0.9f);
  }
  positionnerAngleVanne(angleCible);

  String valveDisplay = (statutVanne == "FERMEE") ? "CLOSED" : "OPEN";

  // Serial Monitor output block
  Serial.print("[STATE] valve "); Serial.print(valveDisplay);
  Serial.print(" · alert "); Serial.print(etatAlerte);
  Serial.print(" · type "); Serial.println(typeAlerte);

  // Serial: "[VALVE] 60% open (ECO_NUIT) · demand = Y L/min → delivered = X L/min · avoided = Z L/min"
  Serial.print("[VALVE] ");
  Serial.print(ouverturePct);
  Serial.print("% open (");
  Serial.print(regime);
  Serial.print(") · demand = ");
  Serial.print(debitBrut, 1);
  Serial.print(" L/min -> delivered = ");
  Serial.print(debitEau, 1);
  Serial.print(" L/min · avoided = ");
  Serial.print(debitEvite, 1);
  Serial.println(" L/min");
}

// ==============================================================================
//  TELEMETRY: read sensor -> POST plain HTTP -> sync valve
// ==============================================================================
void envoyerMesureEtSynchroniser() {
  verifierConnexionWiFi();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Skip: Wi-Fi not connected.");
    return;
  }

  // 1. Read potentiometer (12-bit ADC 0-4095)
  int   rawADC = analogRead(POT_PIN);
  float flow   = round((rawADC / 4095.0f) * DEBIT_MAX * 10.0f) / 10.0f;

  Serial.println("\n--------------------------------------------------");
  Serial.print("[SENSOR] flow = "); Serial.print(flow, 1);
  Serial.print(" L/min (raw ADC "); Serial.print(rawADC); Serial.println(")");

  // 2. Initialize plain HTTP client (no TLS handshake overhead)
  WiFiClient client;
  HTTPClient http;
  http.setTimeout(5000);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);

  if (!http.begin(client, SERVER_URL)) {
    Serial.println("[HTTP] Error: http.begin() failed");
    Serial.println("  Hint: wrong URL or network unreachable.");
    return;
  }

  // 3. HTTP Headers
  http.addHeader("Content-Type", "application/x-www-form-urlencoded");
  http.addHeader("ngrok-skip-browser-warning", "true");
  http.addHeader("User-Agent", "ESP32-HydroMind/1.0");

  // 4. POST payload
  String postData = "debit_eau=" + String(flow, 2);

  unsigned long t0 = millis();
  int httpCode = http.POST(postData);
  unsigned long durationMs = millis() - t0;

  // 5. Handle response
  if (httpCode == HTTP_CODE_OK) {
    Serial.print("[HTTP] 200 in ");
    Serial.print(durationMs);
    Serial.println(" ms");

    String payload = http.getString();
    traiterReponseServeur(payload, flow);

  } else if (httpCode > 0) {
    Serial.print("[HTTP] Error HTTP ");
    Serial.print(httpCode);
    Serial.print(" in ");
    Serial.print(durationMs);
    Serial.println(" ms");

    if (httpCode == 502 || httpCode == 504) {
      Serial.println("  Hint: ngrok is running but local XAMPP/Apache is stopped.");
    } else if (httpCode == 404) {
      Serial.println("  Hint: wrong URL (recevoir_donnees.php not found on XAMPP).");
    } else if (httpCode == 301 || httpCode == 302) {
      Serial.println("  Hint: HTTP redirected -- check ngrok URL format (http vs https).");
    } else {
      Serial.println("  Hint: XAMPP server error or MySQL stopped.");
    }

  } else {
    Serial.print("[HTTP] Error ");
    Serial.print(httpCode);
    Serial.print(" (");
    Serial.print(HTTPClient::errorToString(httpCode));
    Serial.println(")");

    if (httpCode == HTTPC_ERROR_CONNECTION_REFUSED) {
      Serial.println("  Hint: ngrok not running / connection refused on port 80.");
    } else if (httpCode == HTTPC_ERROR_READ_TIMEOUT) {
      Serial.println("  Hint: XAMPP stopped or request timed out.");
    } else {
      Serial.println("  Hint: ngrok not running, wrong URL, or Wokwi network issue.");
    }
  }

  http.end();
}

// ==============================================================================
//  SETUP
// ==============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("================================================");
  Serial.println("    HydroMind -- SMART WATER SYSTEM (Wokwi)");
  Serial.println("    ESP32 | Potentiometer D34 | Servo D18");
  Serial.println("================================================");

  // Servo setup (diagram.json pin 18)
  vanne.setPeriodHertz(50);
  vanne.attach(SERVO_PIN, 500, 2400);
  positionnerVanne(true); // Valve OPEN (0 deg) at startup

  // ADC Potentiometer (pin 34)
  pinMode(POT_PIN, INPUT);
  analogReadResolution(12);

  // Wi-Fi
  verifierConnexionWiFi();

  Serial.println("Init OK -- Telemetry started.\n");
}

// ==============================================================================
//  LOOP
// ==============================================================================
void loop() {
  unsigned long now = millis();

  if (now - dernierEnvoi >= SEND_INTERVAL_MS) {
    dernierEnvoi = now;
    envoyerMesureEtSynchroniser();
  }

  delay(20); // Yield to FreeRTOS scheduler
}
