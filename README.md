# 💧 HydroMind — Système Intelligent de Détection de Fuites d'Eau

> **Hackathon 2026** · *Chaque goutte compte. Chaque fuite est détectée.*  
> Plateforme IoT & Smart Water Management connectant un capteur virtuel ESP32 (Wokwi), un backend PHP/MySQL (XAMPP), une cartographie interactive (Leaflet) et un système d'alerte d'urgence multi-canal (SMS & Telegram Bot).

---

## 📌 Architecture Globale du Projet

```
                     ┌───────────────────────────────────────────────┐
                     │          ESP32 WOKWI (SIMULATION IoT)         │
                     │  - Potentiomètre (Broche 34) : Débit (L/min) │
                     │  - Servomoteur (Broche 18)   : Vanne physique │
                     └───────────────────────┬───────────────────────┘
                                             │ HTTP (POST / JSON)
                                             ▼
                     ┌───────────────────────────────────────────────┐
                     │            TUNNEL NGROK (HTTP / HTTPS)        │
                     │   http://earphone-baffle-prone.ngrok-free.dev │
                     └───────────────────────┬───────────────────────┘
                                             │
                                             ▼
                     ┌───────────────────────────────────────────────┐
                     │           BACKEND PHP / MySQL (XAMPP)         │
                     │  - recevoir_donnees.php : Traitement & Alerte │
                     │  - controler_vanne.php  : Actionneur & Nuit   │
                     │  - lire_donnees.php     : Télémétrie 2 s      │
                     │  - notifier.php         : SMS / Telegram      │
                     └───────────────────────┬───────────────────────┘
                                             │
                                             ▼
                     ┌───────────────────────────────────────────────┐
                     │         TABLEAU DE BORD WEB (FRONTEND)        │
                     │  - dashboard.html : Supervision live 2s       │
                     │  - Chart.js       : Courbe débit vs seuil     │
                     │  - Leaflet.js     : Carte GPS interactive     │
                     │  - auth.html      : Espace compte technicien  │
                     └───────────────────────────────────────────────┘
```

---

## 🗂️ Structure des Fichiers

```
kizuna_water/
├── assets/
│   ├── app.js                 # Logique JS temps réel (polling 2s, Leaflet, Chart.js, vanne)
│   └── style.css              # Design professionnel Smart City / Dashboard IoT
├── wokwi_esp32/
│   ├── diagram.json           # Schéma de câblage Wokwi (ESP32 DevKit + Potentiomètre + Servo)
│   ├── esp32-http-server.ino  # Code Arduino/ESP32 connecté à Ngrok
│   ├── libraries.txt          # Dépendances Wokwi (ESP32Servo, ArduinoJson)
│   └── wokwi-project.txt      # Métadonnées du projet de simulation
├── auth.html                  # Interface de connexion / inscription des techniciens
├── auth.php                   # Gestion des sessions techniciens
├── config.php                 # Configuration base de données PDO & clés d'API
├── controler_debit.php        # Contrôle proportionnel du débit (régimes & ouverture de vanne)
├── controler_vanne.php        # Endpoint de commande vanne (OUVERTE/FERMEE) & mode nuit
├── dashboard.html             # Centre de contrôle temps réel avec KPIs et carte Leaflet
├── database.sql               # Script SQL de création des tables et compte de démo
├── index.html                 # Site vitrine public HydroMind
├── lire_donnees.php           # API retournant les 30 dernières mesures, vanne et régime
├── lire_regime.php            # API légère retournant le régime actif pour le script Python
├── login.php                  # Endpoint de connexion technicien (bcrypt verify)
├── logout.php                 # Endpoint de déconnexion
├── migration_v5.sql           # Script de migration vers le contrôle proportionnel de débit
├── notifier.php               # Module d'envoi d'alertes (SMS Twilio sans lien vs Telegram Maps)
├── recevoir_donnees.php       # Réception de la télémétrie ESP32, bridage & règles R1/R2
├── regime.php                 # Moteur central de calcul du régime et de l'ouverture
├── register.php               # Endpoint d'inscription des techniciens
├── signaler_anomalie.php      # Endpoint de signalement d'anomalies (ALERTE/FERMETURE)
├── update_preferences.php     # Mise à jour des canaux de notification (SMS/Telegram)
├── .gitignore                 # Exclusion des fichiers temporaires, logs et caches Python
└── README.md                  # Documentation complète du projet
```

---

## 🚀 Guide d'Installation et de Démarrage

### 1. Prérequis
- **XAMPP** (Apache & MySQL actifs) : [Télécharger XAMPP](https://www.apachefriends.org/)
- **Ngrok** : [Télécharger Ngrok](https://ngrok.com/)
- Un navigateur Web moderne (Chrome, Edge, Firefox)
- Un compte gratuit sur [Wokwi](https://wokwi.com/) (ou l'extension VS Code Wokwi)

### 2. Base de données MySQL
1. Démarrez **Apache** et **MySQL** depuis le panneau de contrôle XAMPP.
2. Ouvrez **phpMyAdmin** : `http://localhost/phpmyadmin/`.
3. Cliquez sur l'onglet **Importer**, sélectionnez le fichier `database.sql` situé dans `c:\xampp\htdocs\kizuna_water\database.sql`, puis cliquez sur **Exécuter**.
   > Le script crée la base `kizuna_water`, les tables `consommation`, `etat_systeme`, `workers`, `notifications_log`, ainsi que le compte de test :
   > - **Email** : `technicien@kizuna.tn`
   > - **Mot de passe** : `Kizuna2026!`

### 3. Ouvrir le Tableau de Bord
Ouvrez votre navigateur :
👉 `http://localhost/kizuna_water/dashboard.html`

Pour accéder à l'espace technicien et régler les alertes d'urgence :
👉 `http://localhost/kizuna_water/auth.html` (ou cliquez sur **⚙ Paramètres** dans le dashboard).

---

## 🔌 Run the ESP32 simulation (Wokwi)

Cette section détaille la mise en œuvre de la simulation IoT sous Wokwi connectée à XAMPP via plain HTTP.

### 1. Démarrer XAMPP
- Lancez le **XAMPP Control Panel**.
- Démarrez les modules **Apache** (port 80) et **MySQL** (port 3306).
- Vérifiez que la base `kizuna_water` est bien importée depuis `database.sql`.

### 2. Lancer le Tunnel Ngrok (Plain HTTP)
Pour que la simulation Wokwi dans le cloud puisse joindre votre serveur XAMPP local sans aucun échec de poignée de main TLS (SSL handshake), lancez ngrok avec le flag `--scheme http,https` :
```bash
ngrok http 80 --scheme http,https
```
Ngrok expose alors deux URL d'accès (HTTP et HTTPS). L'ESP32 utilise l'URL **plain HTTP** (port 80) :
```
http://earphone-baffle-prone.ngrok-free.dev/kizuna_water/recevoir_donnees.php
```
> **Note :** Si votre sous-domaine ngrok change lors d'un redémarrage, mettez simplement à jour `SERVER_URL_NGROK` au sommet de `wokwi_esp32/esp32-http-server.ino`.

### 3. Charger les fichiers dans Wokwi
1. Ouvrez un projet ESP32 sur [Wokwi ESP32](https://wokwi.com/projects/new/esp32) ou dans l'extension **Wokwi for VS Code**.
2. Copiez/collez les 3 fichiers du dossier `wokwi_esp32/` dans l'éditeur Wokwi :
   - `esp32-http-server.ino` (code source C++ du microcontrôleur)
   - `diagram.json` (câblage matériel : Potentiomètre sur GPIO 34, Servomoteur sur GPIO 18)
   - `libraries.txt` (dépendances : `ArduinoJson` et `ESP32Servo`)
3. Vérifiez le bloc de configuration au sommet de `esp32-http-server.ino` :
   ```cpp
   #define USE_LOCAL_GATEWAY 0  // 0 = Tunnel Ngrok cloud | 1 = Passerelle locale VS Code (host.wokwi.internal)
   const char* SERVER_URL_NGROK = "http://earphone-baffle-prone.ngrok-free.dev/kizuna_water/recevoir_donnees.php";
   const char* SERVER_URL_LOCAL = "http://host.wokwi.internal/kizuna_water/recevoir_donnees.php";
   ```

### 4. Démarrer la Simulation (Press Play)
- Cliquez sur le bouton vert **Play (Démarrer la simulation)**.
- Ouvrez le **Serial Monitor** (115200 baud).
- L'ESP32 affiche la bannière d'accueil **HydroMind**, se connecte au réseau Wi-Fi virtuel `Wokwi-GUEST`, puis transmet la télémétrie toutes les **1500 ms** (1.5 s).
- Chaque mesure génère un bloc clair et structuré :
  ```
  [SENSOR] flow = 2.0 L/min (raw ADC 546)
  [HTTP] 200 in 125 ms
  [STATE] valve OPEN · alert NORMAL · type NONE
  ```
  Et lorsque la vanne se ferme automatiquement suite à une alerte :
  ```
  [SENSOR] flow = 8.5 L/min (raw ADC 2320)
  [HTTP] 200 in 118 ms
  [STATE] valve CLOSED · alert FERMEE · type RUPTURE
  [VALVE CLOSED] real flow = 0 L/min, avoided flow = 8.5 L/min
  ```

---

### 📊 Table de Correspondance Potentiomètre % ↔ Débit (0–15 L/min)

Le potentiomètre sur la broche analogique **GPIO 34** (ADC 12 bits, 0–4095) simule le capteur de débit d'eau physique.

$$\text{Débit (L/min)} = \left(\frac{\text{ADC}}{4095}\right) \times 15.0 = \left(\frac{\text{Position \%}}{100}\right) \times 15.0$$

| Position Potentiomètre (%) | Valeur ADC brute (12 bits) | Débit calculé (L/min) | Seuil & Régime de Fonctionnement | État Système (`etat_alerte`) | Angle Servomoteur & Statut Vanne |
|:---:|:---:|:---:|:---|:---:|:---:|
| **0 %** | 0 | **0.0 L/min** | Absence d'écoulement / vanne coupée | `NORMAL` | **0°** · OUVERTE |
| **5 %** | ~205 | **0.8 L/min** | Nuit nominale (< `SEUIL_NUIT` 1.0 L/min) | `NORMAL` | **0°** · OUVERTE |
| **10 %** | ~410 | **1.5 L/min** | Jour nominal / **Fuite la Nuit** (> 1.0 L/min) | `NORMAL` (jour) / `ALERTE` (nuit) | **0°** · OUVERTE |
| **20 %** | ~819 | **3.0 L/min** | Micro-fuite jour si soutenu ($]2.5, 5.0[$, R5) | `ALERTE` (si persistant) | **0°** · OUVERTE |
| **33.3 %** | ~1365 | **5.0 L/min** | **Seuil Jour (`SEUIL_JOUR`)** | `NORMAL` | **0°** · OUVERTE |
| **40 %** | ~1638 | **6.0 L/min** | Dépassement seuil jour (Règle R2) | `ALERTE` (`DEPASSEMENT`) | **0°** · OUVERTE |
| **53.3 %** | ~2184 | **8.0 L/min** | **Seuil Rupture (`SEUIL_RUPTURE`)** | `FERMEE` (après 3 mesures) | **90° · FERMÉE (Coupure)** |
| **60 %** | ~2457 | **9.0 L/min** | Rupture franche de canalisation (Règle R1) | `FERMEE` (`RUPTURE`) | **90° · FERMÉE (Coupure)** |
| **80 %** | ~3276 | **12.0 L/min** | Rupture sévère à haut débit | `FERMEE` (`RUPTURE`) | **90° · FERMÉE (Coupure)** |
| **100 %** | 4095 | **15.0 L/min** | Débit physique maximal de l'installation | `FERMEE` (`RUPTURE`) | **90° · FERMÉE (Coupure)** |

---

### 🎯 Scénarios de Démonstration (Demo Scenarios)

#### Scénario 1 : Fonctionnement Normal en Journée (Consommation Maîtrisée)
1. Dans Wokwi, placez le potentiomètre vers **15–20 %** (débit mesuré $\approx 2.3$ à $3.0$ L/min, inférieur au seuil jour de $5.0$ L/min).
2. L'ESP32 transmet les mesures au serveur toutes les 1.5 s.
3. Sur le tableau de bord (`dashboard.html`) :
   - Statut de la vanne : **OUVERTE** (badge vert).
   - Carte Leaflet : Secteur A ESPRIT en statut normal vert/bleu.
   - Servomoteur dans Wokwi : reste stable à **0°**.
   - Console Serial ESP32 : `[STATE] valve OPEN · alert NORMAL · type NONE`.

#### Scénario 2 : Rupture Franche & Coupure Automatique d'Urgence (Règle R1)
1. Tournez le potentiomètre au-delà de 55 % (ex: **60 % $\rightarrow 9.0$ L/min**, supérieur à `SEUIL_RUPTURE` = $8.0$ L/min).
2. Au bout de 3 mesures consécutives $\ge 8.0$ L/min (~4.5 secondes) :
   - `recevoir_donnees.php` enclenche la règle de sécurité **R1 RUPTURE** et bascule `statut_vanne` à `FERMEE`.
   - L'ESP32 reçoit l'ordre dans la réponse JSON et actionne instantanément le servomoteur à **90°** (fermeture physique de la vanne).
   - Le Serial Monitor affiche :
     ```
     [STATE] valve CLOSED · alert FERMEE · type RUPTURE
     [VALVE CLOSED] real flow = 0 L/min, avoided flow = 9.0 L/min
     ```
   - Le tableau de bord passe en alerte rouge avec pulsation cartographique.
   - Les alertes d'urgence sont envoyées aux techniciens (SMS et/ou Telegram Bot avec coordonnées GPS).
   - L'indicateur d'**Eau Économisée** commence à s'incrémenter en temps réel.

#### Scénario 3 : Surveillance Nocturne & Détection Mode Nuit (Règle R2 Nuit & R3 MNF)
1. Sur le tableau de bord, cliquez sur **« ☀️ Mode Nuit : OFF »** pour l'activer (**🌙 Mode Nuit : ON**).
2. Le seuil de tolérance bascule automatiquement de $5.0$ à **$1.0$ L/min**.
3. Réglez le potentiomètre sur **15 %** ($\approx 2.0$ L/min).
4. Cette valeur est tolérée de jour, mais constitue une anomalie grave la nuit :
   - Le système déclenche une alerte immédiate (`DEPASSEMENT` ou coupure `MNF` si persistante).
   - La vanne est fermée à **90°** pour protéger l'infrastructure.

#### Scénario 4 : Réouverture Manuelle par l'Opérateur
1. Une fois l'incident résolu, cliquez sur **« Ouvrir la vanne »** sur le tableau de bord.
2. La base MySQL met à jour `statut_vanne = 'OUVERTE'` et réinitialise `etat_alerte = 'NORMAL'`.
3. Dès la transmission suivante (dans les 1.5 s), l'ESP32 lit le statut `OUVERTE` et replace le servomoteur à **0°**.
4. Le débit physique réel reprend normalement.

#### Scénario 5 : Vérification des Canaux d'Alerte Technicien (SMS vs Telegram)
1. Rendez-vous dans **⚙ Paramètres du compte** (`auth.html`).
2. Observez la distinction stricte de sécurité :
   - **SMS d'urgence** : Format texte brut pur (sans URL externe pour conformité opérateur), indiquant l'adresse et les coordonnées GPS.
   - **Telegram Bot** : Message enrichi interactif avec lien cliquable Google Maps pointant vers le secteur de la fuite.
3. Testez l'envoi en direct avec le bouton **« ⚡ Tester l'alerte »**.

---

## 🔍 Règles de Détection (R1 à R6)

Les fuites sont qualifiées par leur **durée** et leur **profil statistique** (et non par un simple pic isolé). Les seuils et constantes sont rigoureusement alignés entre `config.php` et `detecteur_fuite.py` :
- `SEUIL_JOUR = 5.0 L/min`, `SEUIL_NUIT = 1.0 L/min`
- `SEUIL_RUPTURE = 8.0 L/min`, `N_RUPTURE = 3`, `N_SOUTENU = 5`
- `MICRO_RATIO = 0.5`, `ZSCORE_SEUIL = 2.0`, `STD_MIN = 0.5`, `SAUT_MIN = 3.0`
- **R6 Prédiction :** `N_PRED = 12`, `PRED_PENTE_MIN = 0.05 L/min/mesure`, `PRED_R2_MIN = 0.6`, `PRED_HAUSSE_MIN = 0.5 L/min`, `PRED_COOLDOWN_MIN = 30 min`, `PRED_ETA_MAX_MIN = 120 min`

| Règle | Nom | Composant | Contexte | Condition de déclenchement | Action État (`changerEtatAlerte`) | Action Vanne |
|:---:|:---|:---|:---:|:---|:---|:---:|
| **R1** | **RUPTURE** | Backend PHP (`recevoir_donnees.php`) | Jour & Nuit | Mesure actuelle + les $N_{\text{RUPTURE}}-1$ précédentes $\ge$ `SEUIL_RUPTURE` (3 consécutives $\ge 8.0$ L/min) | État `FERMEE`, type `RUPTURE` | **Fermeture vanne** (`statut_vanne='FERMEE'`) |
| **R2** | **DEPASSEMENT** | Backend PHP (`recevoir_donnees.php`) | Jour & Nuit | Débit $>$ seuil actif (`SEUIL_JOUR` 5.0 L/min le jour, `SEUIL_NUIT` 1.0 L/min la nuit) | `alerte_fuite=1` sur la ligne, état `ALERTE`, type `DEPASSEMENT` | Vanne reste **OUVERTE** |
| **R3** | **MNF (Minimum Night Flow)** | Détecteur IA (`detecteur_fuite.py`) | Nuit uniquement | Les $N_{\text{SOUTENU}}$ dernières mesures (5 consécutives) $>$ `SEUIL_NUIT` $\times$ `MICRO_RATIO` ($> 0.5$ L/min) | État `FERMEE`, type `MNF` (via `signaler_anomalie.php`) | **Fermeture vanne** (`statut_vanne='FERMEE'`) |
| **R4** | **PIC** | Détecteur IA (`detecteur_fuite.py`) | Jour & Nuit | $z \ge$ `ZSCORE_SEUIL` ($2.0$) avec $\sigma = \max(\sigma, \text{STD\_MIN})$ **ET** (débit $>$ seuil actif **OU** saut $\ge$ `SAUT_MIN` $3.0$ L/min) | État `ALERTE`, type `PIC` (via `signaler_anomalie.php`) | Vanne reste **OUVERTE** |
| **R5** | **MICRO_FUITE** | Détecteur IA (`detecteur_fuite.py`) | Jour uniquement | Les $N_{\text{SOUTENU}}$ dernières mesures (5 consécutives) toutes dans $]\text{SEUIL\_JOUR} \times \text{MICRO\_RATIO},\, \text{SEUIL\_JOUR}[$ ($]2.5,\, 5.0[$ L/min) | État `ALERTE`, type `MICRO_FUITE` (via `signaler_anomalie.php`) | Vanne reste **OUVERTE** |
| **R6** | **PREDICTION** | Détecteur IA (`detecteur_fuite.py`) | Jour & Nuit | Régression linéaire pure-Python sur les $N_{\text{PRED}}=12$ dernières mesures avec vanne ouverte : pente $\ge 0.05$ L/min/mesure, $R^2 \ge 0.6$, hausse $\ge 0.5$ L/min, débit $<$ cible, $\text{ETA} \le 120$ min | Aucun changement d'état (reste `NORMAL`), notification Telegram préventive (`notifierPrediction`) | Vanne reste **OUVERTE** |

> **Règle de sécurité stricte :** Seules les règles **R1** (Rupture majeure) et **R3** (Débit nocturne soutenu MNF) ferment automatiquement la vanne. Les règles R2, R4 et R5 placent le système sous surveillance (`ALERTE`) sans couper l'eau des usagers. La règle R6 est une prédiction statistique préventive informant les techniciens par Telegram avant franchissement d'un seuil critique (l'état reste `NORMAL` et la vanne reste ouverte).

### 💧 Règle Physique & Calcul Réel de l'Eau Économisée (`eau_economisee`)

#### 1. Règle Physique de Coupure
Lorsque la vanne est fermée (`statut_vanne = 'FERMEE'`), aucun flux d'eau ne traverse physiquement le compteur :
- Dans la table `consommation`, le débit d'eau physique enregistré est **`debit_eau = 0.0 L/min`**.
- La valeur télémesurée transmise par le capteur (l'eau qui aurait été perdue sans la fermeture) est stockée dans la colonne dédiée **`debit_evite`**.
- Toutes les règles de détection (R1, R2) ainsi que l'hystérésis sont ignorées pour cette mesure.
- **Sécurité absolue** : tant que la vanne est `FERMEE`, l'état `etat_alerte` reste impérativement `FERMEE`. L'hystérésis des 5 mesures consécutives ne le ramène **JAMAIS** à `NORMAL` sous prétexte que `debit_eau = 0` est stocké. Seule une réouverture manuelle explicite par un opérateur via `controler_vanne.php` réinitialise l'état à `NORMAL`.

#### 2. Formule Mathématique de Calcul Réel (`lire_donnees.php`)
L'indicateur d'eau préservée repose sur l'intégration temporelle réelle de l'eau évitée depuis aujourd'hui 00:00 (`timestamp >= CURDATE()`) :

$$\text{Eau Économisée (Litres)} = \sum_{i=1}^{N} \left( \text{debit\_evite}_i \times \Delta t_{i, \text{min}} \right)$$

avec :
$$\Delta t_{i, \text{sec}} = \min\left(10\text{ s}, \max\left(0, t_i - t_{i-1}\right)\right)$$
$$\Delta t_{i, \text{min}} = \frac{\Delta t_{i, \text{sec}}}{60}$$

- $t_i - t_{i-1}$ : durée réelle en secondes écoulée depuis la mesure précédente dans la table de consommation.
- **Plafonnement à 10 secondes** : élimine tout artefact de calcul en cas d'interruption prolongée de transmission de l'ESP32.
- **Période** : totalisé depuis aujourd'hui 00:00 (`CURDATE()`).
- Le total est arrondi à 2 décimales et retourné sous la clé JSON existante `stats.eau_economisee`, garantissant la continuité opérationnelle du tableau de bord.

---

## 🤖 Phase C : Détecteur IA Python (`python/detecteur_fuite.py`)

Analyse continue des mesures MySQL avec détection avancée sans fausse ligne insérée dans `consommation` (toutes les données proviennent du capteur via `recevoir_donnees.php`) :

- **R3 MNF** : Détection de débit anormal persistant la nuit (Minimum Night Flow).
- **R4 PIC** : Détection statistique par Z-score robuste avec $\sigma_{\min} = 0.5$ et critère de saut minimal de $3.0$ L/min pour éliminer les faux positifs sur petites hausses.
- **R5 MICRO_FUITE** : Détection de suintement modéré persistant en journée ($]2.5, 5.0[$ L/min sur 5 mesures).
- **R6 PREDICTION** : Prédiction statistique de tendance par régression linéaire sur 12 mesures vanne ouverte, avertissant les techniciens par Telegram avant franchissement d'un seuil critique.
- Les actions de signalement d'alerte, de prédiction et de coupure de sécurité s'exécutent via l'endpoint dédié `signaler_anomalie.php`.

### Installation des dépendances Python

```bash
# Dans votre terminal (réseau requis)
pip install pymysql requests
# ou depuis le dossier python/ :
pip install -r python/requirements.txt
```

### Lancement du détecteur

```bash
# Depuis la racine du projet kizuna_water/
# Boucle continue (analyse toutes les 3 s, Ctrl+C pour arrêter)
python python/detecteur_fuite.py

# Scénario de validation complet en 5 phases (comme le système réel)
python python/detecteur_fuite.py --test

# Une seule analyse puis quitte
python python/detecteur_fuite.py --once

# Lecture seule (aucune action MySQL ni fermeture vanne)
python python/detecteur_fuite.py --dry-run

# Options avancées
python python/detecteur_fuite.py --fenetre 30 --intervalle 2
```

### Sortie typique dans le terminal

```
==============================================================
  HydroMind -- Détecteur IA  |  14:20:00  |  Mode JOUR
  Fenêtre : 25 mesures  |  Seuil actif : 5.0 L/min
--------------------------------------------------------------
  Débit courant  : 3.10 L/min
  Moyenne        : 2.35 L/min  #######
  Écart-type     : 0.500  |  Min : 1.90  Max : 3.20
  Seuil actif    : 5.0 L/min
--------------------------------------------------------------
  [PIC - R4]  Z-score = 1.50 -- Normal
  [ALERTE MICRO-FUITE - R5]  6 mesures consécutives dans ]2.5, 5.0[
  Débit moyen = 3.02 L/min  => Suintement continu confirmé (vanne reste OUVERTE).
  [PREDICTION - R6]  Slope = +0.098 L/min/rdg (+9.45 L/min/min, R² = 0.99) -- Rising trend confirmed!
  ETA to 5.0 L/min : ~16 s
--------------------------------------------------------------
  Statut vanne   : OUVERTE  |  État système : NORMAL
==============================================================
```

### Scénario 6 (Hackathon) : Démonstration complète du système (--test)

1. Dans un terminal, lancez : `python python/detecteur_fuite.py --test`
2. Observez la validation automatique des 6 scénarios :
   - **Phase 1 (Jour)** : 15 mesures normales (~2.0 L/min) -> réseau nominal, vanne OUVERTE, aucune prédiction déclenchée.
   - **Phase 2 (Jour)** : 8 mesures de micro-fuite (2.8–3.2 L/min) -> alerte MICRO_FUITE confirmée, vanne reste OUVERTE, pas de faux PIC au 1er.
   - **Phase 3 (Nuit)** : 10 mesures nuit calmes (0.1–0.2 L/min) puis 6 mesures anormales (0.6–0.9 L/min) -> alerte MNF, vanne FERMÉE.
   - **Phase 4 (Jour)** : Réouverture vanne, 8.5, 9.1 puis 8.8 L/min -> RUPTURE confirmée à la 3e mesure, vanne FERMÉE.
   - **Phase 5 (Jour)** : 14 mesures en hausse 1.0 -> 2.4 L/min -> R6 PREDICTION déclenchée, exactement 1 notification Telegram, vanne reste OUVERTE, état reste NORMAL, puis 5 mesures stables à 1.5 L/min -> réinitialisation de `prediction_active` à 0.
   - **Phase 6 (Contrôle de débit & Régimes)** :
     - Sub-test 6(a) : Nuit + `ECO_NUIT` -> demande 1.0 L/min bridée à 60% (`debit_eau = 0.6`, `debit_evite = 0.4`, ouverture 60%).
     - Sub-test 6(b) : Jour + `EVENEMENT` -> 8 mesures à 3.5 L/min sans alerte grâce au seuil assoupli ($5.0 \times 1.5 = 7.5$ L/min), vanne maintenue OUVERTE.
     - Sub-test 6(c) : `EVENEMENT` -> 3 lectures à 9.0 L/min -> la règle de sécurité R1 (Rupture majeure $\ge 8.0$ L/min) ferme immédiatement la vanne (sécurité prioritaire).
     - Sub-test 6(d) : Dérogation manuelle à 30% -> demande 5.0 L/min livrée à $5.0 \times 30\% = 1.5$ L/min.
     - Sub-test 6(e) : Retour automatique au mode `NORMAL` / auto (ouverture 100%).
3. Le tableau de synthèse terminal affiche le statut `[PASS]` pour les 6 phases.

---

## 🚰 Flow Control (Contrôle Proportionnel du Débit / 流量制御)

HydroMind intègre un contrôle proportionnel de la vanne en complément de l'état binaire OUVERTE / FERMÉE. La vanne peut adopter une ouverture partielle (entre 0% et 100%), permettant de moduler le débit livré en fonction de la demande mesurée par le capteur et du régime d'exploitation actif.

### 1. Formules fondamentales

- **Débit livré (Delivered Flow / 供給流量)** :
  $$\text{debit\_eau} = \text{debit\_brut} \times \frac{\text{ouverture\_pct}}{100}$$
- **Débit évité / économisé (Avoided Flow / 節水流量)** :
  $$\text{debit\_evite} = \text{debit\_brut} - \text{debit\_eau} = \text{debit\_brut} \times \left(1 - \frac{\text{ouverture\_pct}}{100}\right)$$
- **Évaluation des anomalies (R1, R2 et détection IA R3-R6)** :
  Les algorithmes de détection évaluent toujours la **demande réelle** ($\text{debit\_brut}$), et non le débit restreint. Cela garantit qu'un suintement ou une anomalie reste détectable même pendant une phase de bridage.
- **Seuil actif modulé** :
  $$\text{seuil\_actif} = \text{seuil\_base} \times \text{coef}$$
  - En mode Normal ou Eco Nuit : $\text{coef} = 1.0$
  - En mode Événement (`EVENEMENT`) : $\text{coef} = \text{coef\_evenement} = 1.5$ (seuils élargis pour absorber les pics de consommation sans déclencher de fausse alerte).

### 2. Régimes d'exploitation

1. **NORMAL** :
   - Ouverture nominale à 100%, coefficient $\text{coef} = 1.0$.
   - Mode de fonctionnement standard du réseau d'eau potable.
2. **ECO_NUIT (Night Eco / 夜間節水)** :
   - Réduction programmée de l'ouverture pendant les heures creuses nocturnes (`mode_nuit = 1`), typiquement à 60% (`eco_nuit_pct = 60`).
   - Réduit la pression résiduelle nocturne et limite considérablement les pertes d'eau par suintement.
3. **EVENEMENT (Event Mode / イベントモード)** :
   - Conçu pour les périodes de forte demande prévisible (ex. fête de l'Aïd, manifestations sportives).
   - Pas de bridage de débit ($\text{ouverture\_pct} = 100\%$).
   - Multiplicateur de seuil $\text{coef} = 1.5$ (ex. seuil de jour passant de 5.0 à 7.5 L/min).
   - Durée paramétrable de 1 à 72 heures avec retour automatique au régime `NORMAL` à expiration (`evenement_jusqu_a`).
4. **Dérogation manuelle (Manual Opening / 手動開度)** :
   - L'opérateur peut imposer une ouverture manuelle de 10% à 100% via le slider de contrôle.
   - La fermeture totale (0%) s'effectue exclusivement via le bouton d'arrêt d'urgence « Close Valve ».

### 3. Ordre de priorité absolue

Le calcul dynamique du régime (`calculerRegime`) respecte scrupuleusement la hiérarchie suivante :
1. **Priorité 1 : Vanne FERMEE** $\rightarrow$ $\text{ouverture\_pct} = 0\%$, sécurité absolue prioritaire sur toute consigne.
2. **Priorité 2 : Dérogation manuelle (`ouverture_manuelle`)** $\rightarrow$ consigne manuelle de 10% à 100% imposée par l'opérateur.
3. **Priorité 3 : Mode Événement actif (`EVENEMENT`)** $\rightarrow$ $\text{ouverture\_pct} = 100\%$, $\text{coef} = 1.5$ (tant que non expiré).
4. **Priorité 4 : Mode Éco Nuit actif (`ECO_NUIT`) et `mode_nuit = 1`** $\rightarrow$ $\text{ouverture\_pct} = 60\%$, $\text{coef} = 1.0$.
5. **Priorité 5 : Régime standard (`NORMAL`)** $\rightarrow$ $\text{ouverture\_pct} = 100\%$, $\text{coef} = 1.0$.

> [!IMPORTANT]
> La règle d'urgence **R1 (Rupture majeure, débit $\ge 8.0$ L/min pendant 3 mesures)** reste active et prioritaire dans **TOUS** les régimes (y compris en mode `EVENEMENT`) et commande la fermeture immédiate de la vanne.
