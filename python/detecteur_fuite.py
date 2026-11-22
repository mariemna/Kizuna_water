#!/usr/bin/env python3
# =============================================================================
#  HydroMind -- Phase C : Détecteur de Fuites Intelligent (IA) & Contrôle de Débit
#  detecteur_fuite.py
#
#  Analyse les mesures de débit (demande brute) stockées dans MySQL et détecte :
#    - R3 MNF (Minimum Night Flow, nuit) : débit soutenu > (SEUIL_NUIT * coef) * MICRO_RATIO
#    - R4 PIC (jour & nuit)             : z-score avec std_min et saut/seuil min (seuil_actif = base * coef)
#    - R5 MICRO_FUITE (jour)            : suintement persistant ]0.5 * seuil_actif, seuil_actif[
#    - R6 PREDICTION (jour & nuit)      : régression linéaire pure vanne ouverte (ouverture_pct > 0)
#
#  Modes d'exécution :
#    python detecteur_fuite.py              -> boucle continue (Ctrl+C pour stop)
#    python detecteur_fuite.py --test       -> scénario de validation 6 phases
#    python detecteur_fuite.py --dry-run    -> lecture seule, aucun appel API
#    python detecteur_fuite.py --once       -> une seule analyse puis quitte
# =============================================================================

import sys
import time
import math
import argparse
import signal
import datetime

try:
    import pymysql
except ImportError:
    print("[ERROR] Missing 'pymysql' module.")
    print("        Run: pip install pymysql requests")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("[ERROR] Missing 'requests' module.")
    print("        Run: pip install pymysql requests")
    sys.exit(1)


# =============================================================================
#  CONFIGURATION & CONSTANTES DE DÉTECTION (identiques à config.php)
# =============================================================================

DB_CONFIG = {
    "host":            "localhost",
    "port":            3306,
    "user":            "root",
    "password":        "",
    "database":        "kizuna_water",
    "charset":         "utf8mb4",
    "cursorclass":     pymysql.cursors.DictCursor,
    "connect_timeout": 5,
}

API_BASE_URL = "http://localhost/kizuna_water"

# Constantes synchronisées avec config.php
SEUIL_JOUR    = 5.0
SEUIL_NUIT    = 1.0
SEUIL_RUPTURE = 8.0
N_RUPTURE     = 3
N_SOUTENU     = 5
MICRO_RATIO   = 0.5
ZSCORE_SEUIL  = 2.0
STD_MIN       = 0.5
SAUT_MIN      = 3.0

# Constantes R6 Prédiction de Fuite
N_PRED            = 12
PRED_PENTE_MIN    = 0.05   # L/min par mesure
PRED_R2_MIN       = 0.6
PRED_HAUSSE_MIN   = 0.5    # L/min hausse minimale sur la fenêtre
PRED_COOLDOWN_MIN = 30     # minutes
PRED_ETA_MAX_MIN  = 120    # minutes

# Fenêtre d'analyse glissante (N dernières mesures)
FENETRE_ANALYSE     = 25
INTERVALLE_BOUCLE_S = 3


# =============================================================================
#  COULEURS TERMINAL (ANSI)
# =============================================================================

USE_COLOR = sys.stdout.isatty()

def c(code, text):
    return f"\033[{code}m{text}\033[0m" if USE_COLOR else text

ROUGE   = lambda t: c("91;1", t)
ORANGE  = lambda t: c("93;1", t)
VERT    = lambda t: c("92;1", t)
BLEU    = lambda t: c("94;1", t)
GRIS    = lambda t: c("90",   t)
BOLD    = lambda t: c("1",    t)
CYAN    = lambda t: c("96",   t)


# =============================================================================
#  CONNEXION MYSQL & LECTURE
# =============================================================================

def connecter_mysql():
    """Opens and returns an autocommit PyMySQL connection. Raises an exception on failure."""
    try:
        conn = pymysql.connect(**DB_CONFIG)
        conn.autocommit(True)
        return conn
    except pymysql.err.OperationalError as e:
        raise ConnectionError(
            f"Unable to connect to MySQL ({DB_CONFIG['host']}:{DB_CONFIG['port']}): {e}"
        )


def lire_etat_systeme(conn):
    """
    Returns system state dictionary including prediction flags, flow regimes, and active coef.
    Handles event expiration automatically (reverting to NORMAL if expired).
    """
    with conn.cursor() as cur:
        cur.execute(
            "SELECT statut_vanne, mode_nuit, etat_alerte, type_alerte, "
            "prediction_active, prediction_depuis, prediction_eta_min, prediction_pente, "
            "mode_regime, evenement_jusqu_a, ouverture_manuelle, ouverture_pct "
            "FROM etat_systeme WHERE id = 1"
        )
        row = cur.fetchone()
    if not row:
        raise RuntimeError("Table etat_systeme is empty. Check database.sql.")

    mode_regime = (row.get("mode_regime") or "NORMAL").upper()
    evenement_jusqu_a = row.get("evenement_jusqu_a")
    now = datetime.datetime.now()

    coef = 1.0
    regime = "NORMAL"

    if mode_regime == "EVENEMENT":
        if evenement_jusqu_a is None or evenement_jusqu_a > now:
            regime = "EVENEMENT"
            # Read coef from profils_secteur
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT coef_evenement FROM profils_secteur WHERE secteur = 'Sector A — ESPRIT Zone / El Ghazala' LIMIT 1")
                    s_row = cur.fetchone()
                    coef = float(s_row["coef_evenement"]) if s_row and s_row.get("coef_evenement") is not None else 1.5
            except Exception:
                coef = 1.5
        else:
            # Expired: reverts to NORMAL
            regime = "NORMAL"
            coef = 1.0
            with conn.cursor() as cur:
                cur.execute("UPDATE etat_systeme SET mode_regime = 'NORMAL', evenement_jusqu_a = NULL WHERE id = 1")
    elif mode_regime == "ECO_NUIT":
        regime = "ECO_NUIT"
        coef = 1.0
    else:
        regime = "NORMAL"
        coef = 1.0

    return {
        "statut_vanne":       row["statut_vanne"],
        "mode_nuit":          bool(row["mode_nuit"]),
        "etat_alerte":        row["etat_alerte"] or "NORMAL",
        "type_alerte":        row["type_alerte"],
        "prediction_active":  bool(row.get("prediction_active", 0)),
        "prediction_depuis":  row.get("prediction_depuis"),
        "prediction_eta_min": row.get("prediction_eta_min"),
        "prediction_pente":   row.get("prediction_pente"),
        "mode_regime":        regime,
        "evenement_jusqu_a":  row.get("evenement_jusqu_a"),
        "ouverture_manuelle": row.get("ouverture_manuelle"),
        "ouverture_pct":      int(row.get("ouverture_pct", 100)),
        "coef":               float(coef),
    }


def lire_mesures_prediction(conn, n=N_PRED):
    """
    Retourne les N dernières mesures avec la vanne ouverte ou partiellement ouverte (ouverture_pct > 0),
    de la plus ancienne à la plus récente, en utilisant COALESCE(debit_brut, debit_eau) pour la demande.
    """
    sql = """
        SELECT id, timestamp, COALESCE(debit_brut, debit_eau) AS debit_eau, debit_evite, ouverture_pct
        FROM (
            SELECT id, timestamp, debit_eau, debit_evite, debit_brut, ouverture_pct
            FROM consommation
            WHERE ouverture_pct > 0
            ORDER BY id DESC
            LIMIT %s
        ) AS sub
        ORDER BY id ASC
    """
    with conn.cursor() as cur:
        cur.execute(sql, (n,))
        rows = cur.fetchall()
    return [
        {
            "id":            r["id"],
            "timestamp":     r["timestamp"],
            "debit_eau":     float(r["debit_eau"]),
            "debit_evite":   float(r.get("debit_evite", 0.0)),
            "ouverture_pct": int(r.get("ouverture_pct", 100)),
        }
        for r in rows
    ]


def lire_mesures(conn, n=FENETRE_ANALYSE):
    """
    Retourne les N dernières mesures dans l'ordre chronologique.
    Analyse debit_brut (demande mesurée par le capteur) via COALESCE(debit_brut, debit_eau).
    """
    sql = """
        SELECT id, timestamp, COALESCE(debit_brut, debit_eau) AS debit_eau, debit_evite, alerte_fuite, debit_brut, ouverture_pct
        FROM (
            SELECT id, timestamp, debit_eau, debit_evite, alerte_fuite, debit_brut, ouverture_pct
            FROM consommation
            ORDER BY id DESC
            LIMIT %s
        ) AS sub
        ORDER BY id ASC
    """
    with conn.cursor() as cur:
        cur.execute(sql, (n,))
        rows = cur.fetchall()
    return [
        {
            "id":            r["id"],
            "timestamp":     r["timestamp"],
            "debit_eau":     float(r["debit_eau"]),
            "debit_evite":   float(r.get("debit_evite", 0.0)),
            "alerte_fuite":  bool(r["alerte_fuite"]),
            "debit_brut":    float(r["debit_brut"]) if r.get("debit_brut") is not None else float(r["debit_eau"]),
            "ouverture_pct": int(r.get("ouverture_pct", 100)),
        }
        for r in rows
    ]


# =============================================================================
#  ALGORITHMES DE DÉTECTION (Règles R3, R4, R5)
# =============================================================================

def stats_fenetre(valeurs):
    """
    Calcule moyenne, écart-type non biaisé, min, max sur une liste de floats.
    Retourne (moyenne, std, min_v, max_v).
    """
    n = len(valeurs)
    if n == 0:
        return 0.0, 0.0, 0.0, 0.0
    moyenne = sum(valeurs) / n
    if n < 2:
        return moyenne, 0.0, valeurs[0], valeurs[0]
    variance = sum((x - moyenne) ** 2 for x in valeurs) / (n - 1)
    std = math.sqrt(variance)
    return moyenne, std, min(valeurs), max(valeurs)


def detecter_pic_zscore(valeurs, mode_nuit, coef=1.0):
    """
    R4 PIC : z-score de la dernière mesure vs le reste de la fenêtre avec std = max(std, STD_MIN).
    Pic seulement si z >= ZSCORE_SEUIL ET (dernière > seuil_actif OU dernière - précédente >= SAUT_MIN).
    seuil_actif = base * coef.
    Retourne (est_pic: bool, z: float, moy_ref: float, std_ref: float).
    """
    if len(valeurs) < 4:
        return False, 0.0, 0.0, 0.0

    reference   = valeurs[:-1]
    derniere    = valeurs[-1]
    precedente  = valeurs[-2]
    base_seuil  = SEUIL_NUIT if mode_nuit else SEUIL_JOUR
    seuil_actif = base_seuil * coef

    moy_ref, std_calc, _, _ = stats_fenetre(reference)
    std = max(std_calc, STD_MIN)

    z = (derniere - moy_ref) / std

    condition_z = (z >= ZSCORE_SEUIL)
    condition_declenchement = (derniere > seuil_actif or (derniere - precedente) >= SAUT_MIN)

    est_pic = condition_z and condition_declenchement
    return est_pic, round(z, 2), round(moy_ref, 3), round(std, 3)


def detecter_micro_fuite(valeurs, mode_nuit, coef=1.0):
    """
    R5 MICRO_FUITE (jour uniquement) :
    Zone d'alerte : ]0.5 * seuil_actif, seuil_actif[ où seuil_actif = SEUIL_JOUR * coef.
    Les N_SOUTENU dernières mesures sont toutes dans ]0.5 * seuil_actif, seuil_actif[.
    Retourne (confirmee: bool, n_consec: int, moy_suspecte: float).
    """
    if mode_nuit:
        return False, 0, 0.0

    seuil_actif = SEUIL_JOUR * coef
    borne_basse = 0.5 * seuil_actif
    borne_haute = seuil_actif

    n_consec = 0
    for v in reversed(valeurs):
        if borne_basse < v < borne_haute:
            n_consec += 1
        else:
            break

    confirmee = False
    moy_suspecte = 0.0

    if len(valeurs) >= N_SOUTENU and n_consec >= N_SOUTENU:
        confirmee = True
        derniers = valeurs[-N_SOUTENU:]
        moy_suspecte = round(sum(derniers) / len(derniers), 2)

    return confirmee, n_consec, moy_suspecte


def detecter_mnf(valeurs, mode_nuit, coef=1.0):
    """
    R3 MNF - Minimum Night Flow (nuit uniquement) :
    Les N_SOUTENU dernières mesures sont toutes > (SEUIL_NUIT * coef) * MICRO_RATIO.
    Retourne (confirmee: bool, n_consec: int, moy_suspecte: float).
    """
    if not mode_nuit:
        return False, 0, 0.0

    seuil_mnf = (SEUIL_NUIT * coef) * MICRO_RATIO

    n_consec = 0
    for v in reversed(valeurs):
        if v > seuil_mnf:
            n_consec += 1
        else:
            break

    confirmee = False
    moy_suspecte = 0.0

    if len(valeurs) >= N_SOUTENU and n_consec >= N_SOUTENU:
        confirmee = True
        derniers = valeurs[-N_SOUTENU:]
        moy_suspecte = round(sum(derniers) / len(derniers), 2)

    return confirmee, n_consec, moy_suspecte


def regression_lineaire_pure(mesures):
    """
    Régression linéaire par moindres carrés pure-Python (sans numpy).
    Prend les N dernières mesures de débit [{'timestamp': datetime, 'debit_eau': float}, ...].
    """
    n = len(mesures)
    if n < 2:
        return {
            'n': n,
            'pente_mesure': 0.0,
            'r2': 0.0,
            'intervalle_moyen_sec': 1.5,
            'pente_minute': 0.0,
            'delta_debit': 0.0,
            'premier_debit': mesures[0]['debit_eau'] if n == 1 else 0.0,
            'dernier_debit': mesures[-1]['debit_eau'] if n == 1 else 0.0,
        }

    x = list(range(n))
    y = [m['debit_eau'] for m in mesures]

    x_bar = sum(x) / n
    y_bar = sum(y) / n

    s_xx = sum((xi - x_bar) ** 2 for xi in x)
    s_xy = sum((xi - x_bar) * (yi - y_bar) for xi, yi in zip(x, y))
    s_yy = sum((yi - y_bar) ** 2 for yi in y)

    pente_mesure = (s_xy / s_xx) if s_xx > 0 else 0.0

    if s_xx > 0 and s_yy > 0:
        r2 = (s_xy ** 2) / (s_xx * s_yy)
    else:
        r2 = 0.0

    t_start = mesures[0]['timestamp']
    t_end   = mesures[-1]['timestamp']
    if hasattr(t_end, '__sub__') and hasattr(t_start, '__sub__'):
        total_delta_sec = max(0.0, (t_end - t_start).total_seconds())
    else:
        total_delta_sec = 0.0

    if total_delta_sec > 0:
        intervalle_moyen_sec = total_delta_sec / (n - 1)
    else:
        intervalle_moyen_sec = 1.5

    intervalle_moyen_min = intervalle_moyen_sec / 60.0
    pente_minute = (pente_mesure / intervalle_moyen_min) if intervalle_moyen_min > 0 else 0.0

    return {
        'n': n,
        'pente_mesure': pente_mesure,
        'r2': r2,
        'intervalle_moyen_sec': intervalle_moyen_sec,
        'pente_minute': pente_minute,
        'delta_debit': y[-1] - y[0],
        'premier_debit': y[0],
        'dernier_debit': y[-1],
    }


# =============================================================================
#  COMMUNICATION AVEC LE BACKEND VIA signaler_anomalie.php
# =============================================================================

def signaler_anomalie_api(type_anomalie, debit, action="ALERTE", dry_run=False):
    """
    Signale une anomalie via POST vers signaler_anomalie.php.
    action : 'ALERTE' (vanne reste ouverte) ou 'FERMETURE' (statut_vanne='FERMEE').
    Retourne True si succès.
    """
    if dry_run:
        print(GRIS(f"   [DRY-RUN] Simulated {action} alert ({type_anomalie}, {debit:.2f} L/min)."))
        return True

    url = f"{API_BASE_URL}/signaler_anomalie.php"
    try:
        resp = requests.post(
            url,
            data={
                "type":   type_anomalie,
                "debit":  round(debit, 2),
                "action": action,
            },
            timeout=5,
        )
        data = resp.json()
        if data.get("success"):
            print(VERT(
                f"   [API] Anomaly reported ({action}, {type_anomalie}) "
                f"-- valve: {data.get('statut_vanne')}, state: {data.get('etat_alerte')}"
            ))
            return True
        else:
            print(ORANGE(f"   [API] Unexpected response: {data}"))
            return False
    except requests.RequestException as e:
        print(ROUGE(f"   [API] Failed to report anomaly: {e}"))
        print(GRIS(f"         (Check that Apache XAMPP is running at {API_BASE_URL})"))
        return False


def signaler_prediction_api(debit, pente, r2, eta_min, cible, mode="day", dry_run=False):
    """
    Signale une prédiction R6 via POST vers signaler_anomalie.php avec action=PREDICTION.
    """
    if dry_run:
        print(CYAN(f"   [DRY-RUN] Simulated PREDICTION (trend +{pente:.2f} L/min/min, ETA {eta_min:.1f} min)."))
        return True

    url = f"{API_BASE_URL}/signaler_anomalie.php"
    try:
        resp = requests.post(
            url,
            data={
                "action":  "PREDICTION",
                "type":    "PREDICTION",
                "debit":   round(debit, 2),
                "pente":   round(pente, 4),
                "r2":      round(r2, 3),
                "eta_min": round(eta_min, 2),
                "cible":   round(cible, 2),
                "mode":    mode,
            },
            timeout=5,
        )
        data = resp.json()
        if data.get("success"):
            print(CYAN(
                f"   [API] Prediction reported (+{pente:.2f} L/min/min, ETA {eta_min:.1f} min) "
                f"-- state: {data.get('etat_alerte')}, pred_active: {data.get('prediction_active')}"
            ))
            return True
        else:
            print(ORANGE(f"   [API] Unexpected prediction response: {data}"))
            return False
    except requests.RequestException as e:
        print(ROUGE(f"   [API] Failed to report prediction: {e}"))
        return False


def signaler_prediction_fin_api(dry_run=False):
    """
    Termine silencieusement la prédiction R6 via POST vers signaler_anomalie.php avec action=PREDICTION_FIN.
    """
    if dry_run:
        print(GRIS("   [DRY-RUN] Simulated PREDICTION_FIN."))
        return True

    url = f"{API_BASE_URL}/signaler_anomalie.php"
    try:
        resp = requests.post(
            url,
            data={
                "action": "PREDICTION_FIN",
            },
            timeout=5,
        )
        data = resp.json()
        if data.get("success"):
            print(GRIS("   [API] Prediction ended silently (action=PREDICTION_FIN)."))
            return True
        return False
    except requests.RequestException as e:
        print(ROUGE(f"   [API] Failed to report prediction end: {e}"))
        return False


# =============================================================================
#  AFFICHAGE DES RÉSULTATS
# =============================================================================

SEP  = "=" * 62
SEP2 = "-" * 62

def afficher_header(mode_nuit, seuil, n_mesures, regime="NORMAL", coef=1.0, ouverture_pct=100):
    heure = datetime.datetime.now().strftime("%H:%M:%S")
    ctx = "NIGHT" if mode_nuit else "DAY"
    print(f"\n{BOLD(SEP)}")
    print(f"  {CYAN('HydroMind -- AI Detector')}  |  {heure}  |  Mode {ctx}  |  Regime: {regime} (coef {coef:.1f}, {ouverture_pct}%)")
    print(f"  Window: {n_mesures} measurements  |  Active threshold: {seuil:.2f} L/min")
    print(BOLD(SEP2))


def afficher_stats(valeurs, seuil):
    moy, std, mn, mx = stats_fenetre(valeurs)
    barre_moy  = "#" * min(int(moy * 3), 40)
    print(f"  Current demand : {BOLD(f'{valeurs[-1]:.2f} L/min')}")
    print(f"  Average        : {moy:.2f} L/min  {GRIS(barre_moy)}")
    print(f"  Std deviation  : {std:.3f}  |  Min: {mn:.2f}  Max: {mx:.2f}")
    print(f"  Active threshold: {seuil:.2f} L/min")


def afficher_resultat_pic(est_pic, z, moy_ref, std_ref):
    if est_pic:
        print(f"  {ROUGE('[SPIKE ALERT - R4]')}  Z-score = {ROUGE(str(z))}  "
              f"(threshold z >= {ZSCORE_SEUIL})")
        print(f"  Ref average = {moy_ref:.3f} L/min  |  Std deviation (min {STD_MIN}) = {std_ref:.3f}")
        print(f"  {ROUGE('=> Sudden spike confirmed (valve remains OPEN).')}")
    else:
        print(f"  {VERT('[SPIKE - R4]')}  Z-score = {z:.2f} -- Normal")


def afficher_resultat_micro(confirmee, n_consec, moy_suspecte, seuil_actif):
    b_basse = round(0.5 * seuil_actif, 2)
    b_haute = round(seuil_actif, 2)
    if confirmee:
        print(f"  {ORANGE('[MICRO-LEAK ALERT - R5]')}  {n_consec} consecutive readings in ]{b_basse}, {b_haute}[")
        print(f"  Average flow = {ORANGE(f'{moy_suspecte} L/min')}  "
              f"=> Continuous seepage confirmed (valve remains OPEN).")
    elif n_consec > 0:
        print(f"  {GRIS('[MICRO-LEAK - R5]')}  {n_consec}/{N_SOUTENU} consecutive readings under surveillance ({moy_suspecte} L/min in ]{b_basse}, {b_haute}[)")
    else:
        print(f"  {VERT('[MICRO-LEAK - R5]')}  No daytime seepage detected in ]{b_basse}, {b_haute}[.")


def afficher_resultat_mnf(confirmee, n_consec, moy_suspecte, seuil_mnf):
    if confirmee:
        print(f"  {ROUGE('[MNF ALERT - R3]')}  {n_consec} consecutive nocturnal readings > {seuil_mnf:.2f} L/min")
        print(f"  Average flow = {ROUGE(f'{moy_suspecte} L/min')}  "
              f"=> Sustained nocturnal leak detected (valve CLOSURE required).")
    elif n_consec > 0:
        print(f"  {GRIS('[MNF - R3]')}  {n_consec}/{N_SOUTENU} suspicious consecutive nocturnal readings (> {seuil_mnf:.2f} L/min)")
    else:
        print(f"  {VERT('[MNF - R3]')}  Normal nocturnal flow (<= {seuil_mnf:.2f} L/min).")


def afficher_resultat_prediction(est_pred, reg, eta_min, cible, mode_nuit):
    lbl_cible = "night leak limit" if mode_nuit else "alert threshold"
    if est_pred:
        eta_str = f"{max(1, int(round(eta_min * 60)))} s" if eta_min < 1.0 else f"{round(eta_min)} min"
        print(f"  {CYAN('[PREDICTION - R6]')}  Rising trend confirmed! Slope = +{reg['pente_mesure']:.3f} L/min/rdg "
              f"(+{reg['pente_minute']:.2f} L/min/min, R² = {reg['r2']:.2f})")
        print(f"  First: {reg['premier_debit']:.2f} L/min  |  Last: {reg['dernier_debit']:.2f} L/min  "
              f"(Rise: +{reg['delta_debit']:.2f} L/min)")
        print(f"  Target: {cible:.2f} L/min ({lbl_cible})  |  ETA: ~{eta_str}")
        print(f"  {CYAN('=> Preventive Telegram notification (state remains NORMAL, valve OPEN).')}")
    else:
        if reg['n'] >= N_PRED:
            print(f"  {VERT('[PREDICTION - R6]')}  Slope = {reg['pente_mesure']:.3f} L/min/rdg, R² = {reg['r2']:.2f} -- Nominal trend")
        else:
            print(f"  {GRIS('[PREDICTION - R6]')}  {reg['n']}/{N_PRED} readings in window -- Awaiting data")


def afficher_etat_vanne(statut_vanne, etat_alerte, ouverture_pct=100, regime="NORMAL"):
    c_vanne = VERT(f"OPEN ({ouverture_pct}% · {regime})") if statut_vanne == "OUVERTE" else ROUGE("CLOSED (0%)")
    print(f"  Valve status   : {c_vanne}  |  System state: {BOLD(etat_alerte)}")


# Suivi de la prédiction R6 entre analyses successives
_consec_non_pred = 0

def reinitialiser_pred_tracker():
    global _consec_non_pred
    _consec_non_pred = 0


# =============================================================================
#  ANALYSE UNIQUE
# =============================================================================

def analyser_une_fois(conn, dry_run=False, verbose=True):
    """
    Effectue une analyse complète des mesures récentes selon les règles R3, R4, R5 et R6.
    Retourne un dictionnaire résumant la décision.
    """
    global _consec_non_pred

    # 1. Lire l'état du système & du régime
    etat        = lire_etat_systeme(conn)
    mode_nuit   = etat["mode_nuit"]
    vanne       = etat["statut_vanne"]
    etat_alerte = etat["etat_alerte"]
    coef        = etat["coef"]
    regime      = etat["mode_regime"]
    ouv_pct     = etat["ouverture_pct"]

    base_seuil  = SEUIL_NUIT if mode_nuit else SEUIL_JOUR
    seuil_actif = base_seuil * coef

    # 2. Lire les mesures depuis MySQL (analyse la demande brute)
    mesures = lire_mesures(conn, FENETRE_ANALYSE)
    if not mesures:
        if verbose:
            print(GRIS("  [INFO] No measurements in database. Waiting for ESP32 data..."))
        return {"action": "attente", "vanne": vanne}

    valeurs = [m["debit_eau"] for m in mesures] # COALESCE(debit_brut, debit_eau)
    debit_courant = valeurs[-1]

    if verbose:
        afficher_header(mode_nuit, seuil_actif, len(mesures), regime=regime, coef=coef, ouverture_pct=ouv_pct)
        afficher_stats(valeurs, seuil_actif)
        print(BOLD(SEP2))

    # 3. Évaluation des règles IA : R3 (MNF), R4 (PIC), R5 (MICRO_FUITE) ajustées par coef
    est_mnf, n_mnf, moy_mnf = detecter_mnf(valeurs, mode_nuit, coef=coef)
    est_pic, z, moy_ref, std_ref = detecter_pic_zscore(valeurs, mode_nuit, coef=coef)
    est_micro, n_micro, moy_micro = detecter_micro_fuite(valeurs, mode_nuit, coef=coef)

    # 3b. Évaluation de la règle R6 : PREDICTION (sur N_PRED mesures avec ouverture_pct > 0)
    mesures_pred = lire_mesures_prediction(conn, N_PRED)
    reg_pred = regression_lineaire_pure(mesures_pred)
    cible_pred = (SEUIL_NUIT * coef * MICRO_RATIO) if mode_nuit else (SEUIL_JOUR * coef)

    eta_pred = None
    if reg_pred["pente_minute"] > 0:
        eta_pred = (cible_pred - reg_pred["dernier_debit"]) / reg_pred["pente_minute"]

    cond_alerte_normale = (etat_alerte == "NORMAL")
    cond_vanne_ouverte   = (vanne == "OUVERTE")
    cond_n_pred          = (reg_pred["n"] >= N_PRED)
    cond_pente           = (reg_pred["pente_mesure"] >= PRED_PENTE_MIN)
    cond_r2              = (reg_pred["r2"] >= PRED_R2_MIN)
    cond_hausse          = (reg_pred["delta_debit"] >= PRED_HAUSSE_MIN)
    cond_dernier_inf     = (reg_pred["dernier_debit"] < cible_pred)
    cond_eta             = (eta_pred is not None and 0 < eta_pred <= PRED_ETA_MAX_MIN)

    est_pred = (
        cond_alerte_normale and
        cond_vanne_ouverte and
        cond_n_pred and
        cond_pente and
        cond_r2 and
        cond_hausse and
        cond_dernier_inf and
        cond_eta
    )

    if verbose:
        if mode_nuit:
            seuil_mnf_disp = (SEUIL_NUIT * coef) * MICRO_RATIO
            afficher_resultat_mnf(est_mnf, n_mnf, moy_mnf, seuil_mnf_disp)
        afficher_resultat_pic(est_pic, z, moy_ref, std_ref)
        if not mode_nuit:
            afficher_resultat_micro(est_micro, n_micro, moy_micro, seuil_actif)
        afficher_resultat_prediction(est_pred, reg_pred, eta_pred if eta_pred else 0.0, cible_pred, mode_nuit)
        print(BOLD(SEP2))

    # 4. Prise de décision et actions pour alertes confirmées (R3, R4, R5)
    action_prise = "aucune"

    if est_mnf:
        if vanne == "OUVERTE":
            if verbose:
                print(ROUGE("\n  ==> ANOMALY R3 (MNF) DETECTED -- Automatic valve shutoff..."))
            signaler_anomalie_api("MNF", debit_courant, action="FERMETURE", dry_run=dry_run)
            action_prise = "vanne_fermee:MNF"
        else:
            if verbose:
                print(ORANGE("  ==> R3 (MNF) confirmed but valve already CLOSED."))
            action_prise = "vanne_deja_fermee:MNF"

    elif est_pic:
        if verbose:
            print(ORANGE("\n  ==> ANOMALY R4 (SPIKE) DETECTED -- Alert reported (valve remains OPEN)."))
        signaler_anomalie_api("PIC", debit_courant, action="ALERTE", dry_run=dry_run)
        action_prise = "alerte:PIC"

    elif est_micro:
        if verbose:
            print(ORANGE("\n  ==> ANOMALY R5 (MICRO-LEAK) DETECTED -- Alert reported (valve remains OPEN)."))
        signaler_anomalie_api("MICRO_FUITE", debit_courant, action="ALERTE", dry_run=dry_run)
        action_prise = "alerte:MICRO_FUITE"

    else:
        if verbose:
            print(VERT("  ==> Nominal network. No confirmed leak anomaly detected."))

    # Relire l'état final à jour après action éventuelle des alertes
    etat_final = lire_etat_systeme(conn)

    # 5. Gestion de la prédiction R6 (uniquement si état nominal NORMAL et aucune alerte)
    pred_actuelle = etat.get("prediction_active", False)
    if action_prise != "aucune" or etat_final["etat_alerte"] != "NORMAL":
        if pred_actuelle:
            if verbose:
                print(GRIS("  ==> Anomaly triggered or state left NORMAL -- Ending prediction silently."))
            signaler_prediction_fin_api(dry_run=dry_run)
        _consec_non_pred = 0
    elif est_pred:
        _consec_non_pred = 0
        if verbose:
            print(CYAN("  ==> R6 PREDICTION ACTIVE -- Sending preventive Telegram notification..."))
        signaler_prediction_api(
            debit=reg_pred["dernier_debit"],
            pente=reg_pred["pente_minute"],
            r2=reg_pred["r2"],
            eta_min=eta_pred,
            cible=cible_pred,
            mode=("night" if mode_nuit else "day"),
            dry_run=dry_run
        )
    else:
        if pred_actuelle:
            _consec_non_pred += 1
            if _consec_non_pred >= 3:
                if verbose:
                    print(GRIS("  ==> Prediction conditions stopped holding for 3 consecutive cycles -- Ending prediction silently."))
                signaler_prediction_fin_api(dry_run=dry_run)
                _consec_non_pred = 0
        else:
            _consec_non_pred = 0

    if est_pred or (pred_actuelle and (action_prise != "aucune" or _consec_non_pred == 0)):
        etat_final = lire_etat_systeme(conn)

    if verbose:
        afficher_etat_vanne(etat_final["statut_vanne"], etat_final["etat_alerte"], etat_final["ouverture_pct"], etat_final["mode_regime"])
        print(BOLD(SEP))

    return {
        "action":            action_prise,
        "debit_courant":     debit_courant,
        "est_mnf":           est_mnf,
        "est_pic":           est_pic,
        "z_score":           z,
        "est_micro":         est_micro,
        "n_consec_micro":    n_micro,
        "mode_nuit":         mode_nuit,
        "vanne":             etat_final["statut_vanne"],
        "etat_alerte":       etat_final["etat_alerte"],
        "mode_regime":       etat_final["mode_regime"],
        "ouverture_pct":     etat_final["ouverture_pct"],
        "coef":              etat_final["coef"],
        "est_pred":          est_pred,
        "prediction_active": etat_final.get("prediction_active", False),
        "eta_min":           eta_pred if est_pred else None,
        "pente_minute":      reg_pred["pente_minute"] if (est_pred or reg_pred["n"] >= N_PRED) else None,
        "r2":                reg_pred["r2"] if (est_pred or reg_pred["n"] >= N_PRED) else None,
    }


# =============================================================================
#  MODE --test : SCÉNARIO DE VALIDATION DU SYSTÈME (6 PHASES)
# =============================================================================

def poster_mesure_api(debit):
    """Envoie une mesure à recevoir_donnees.php comme le ferait l'ESP32."""
    url = f"{API_BASE_URL}/recevoir_donnees.php"
    resp = requests.post(url, data={"debit_eau": debit}, timeout=5)
    return resp.json()


def lire_donnees_api():
    """Interroge lire_donnees.php pour obtenir les statistiques et mesures actuelles."""
    url = f"{API_BASE_URL}/lire_donnees.php"
    resp = requests.get(url, timeout=5)
    return resp.json()


def reinitialiser_systeme_api(mode_nuit=0, statut_vanne="OUVERTE", mode_regime="NORMAL", ouverture_manuelle=None, evenement_jusqu_a=None):
    """Réinitialise l'état du système avant chaque phase / sous-test."""
    conn = connecter_mysql()
    with conn.cursor() as cur:
        if statut_vanne == "FERMEE":
            ouv_init = 0
        elif ouverture_manuelle is not None:
            ouv_init = int(ouverture_manuelle)
        elif mode_regime == "ECO_NUIT" and mode_nuit:
            ouv_init = 60
        else:
            ouv_init = 100

        cur.execute(
            """UPDATE etat_systeme 
               SET statut_vanne = %s,
                   mode_nuit = %s,
                   etat_alerte = %s,
                   type_alerte = NULL,
                   alerte_depuis = NULL,
                   prediction_active = 0,
                   prediction_depuis = NULL,
                   prediction_eta_min = NULL,
                   prediction_pente = NULL,
                   mode_regime = %s,
                   evenement_jusqu_a = %s,
                   ouverture_manuelle = %s,
                   ouverture_pct = %s
               WHERE id = 1""",
            (statut_vanne, mode_nuit, "FERMEE" if statut_vanne == "FERMEE" else "NORMAL", mode_regime, evenement_jusqu_a, ouverture_manuelle, ouv_init)
        )
    conn.close()
    return {"statut_vanne": statut_vanne, "mode_nuit": mode_nuit, "mode_regime": mode_regime, "ouverture_pct": ouv_init}


def mode_test(dry_run=False):
    """
    Exécute le protocole de test complet en 6 phases :
      - Phase 1 (Jour) : 15 mesures ~2.0 L/min -> aucune alerte, aucune prédiction
      - Phase 2 (Jour) : 8 mesures 2.8–3.2 L/min -> MICRO_FUITE, vanne reste OUVERTE, pas de PIC au 1er
      - Phase 3 (Nuit) : 10 mesures 0.1–0.2 L/min puis 6 mesures 0.6–0.9 L/min -> MNF, vanne FERMEE
      - Phase 4 (Jour) : vanne rouverte, 8.5, 9.1, 8.8 L/min -> RUPTURE, vanne FERMEE à la 3e mesure
      - Phase 5 (Jour) : 14 mesures 1.0->2.4 L/min -> R6 PREDICTION, 1 Telegram, vanne OUVERTE, puis 5 plats -> 0
      - Phase 6 (Flow Control) :
          (a) night + ECO_NUIT, POST 1.0 -> stored debit_eau 0.6, debit_evite 0.4, ouverture 60
          (b) day + EVENEMENT, 8 readings at 3.5 -> no alert, valve open
          (c) EVENEMENT, 3 x 9.0 -> R1 still closes the valve
          (d) manual opening 30%, POST 5.0 -> debit_eau 1.5
          (e) back to NORMAL/auto
    """
    print(CYAN("\n╔══════════════════════════════════════════════════════════════════╗"))
    print(CYAN("║          HydroMind -- FULL SYSTEM VALIDATION (6 PHASES)          ║"))
    print(CYAN("║   Telemetry via recevoir_donnees.php & Flow Control Validation   ║"))
    print(CYAN("╚══════════════════════════════════════════════════════════════════╝\n"))

    conn = connecter_mysql()

    # Nettoyage initial de la table de consommation pour un test propre
    with conn.cursor() as cur:
        cur.execute("TRUNCATE TABLE consommation")
    conn.commit()

    resultats = {}

    # ── Phase 1 : Day, 15 normal readings ~2.0 L/min ─────────────
    print(BOLD("\n" + "="*62))
    print(BOLD("▶ PHASE 1 : Normal daytime (15 readings ~2.0 L/min) -> Nominal (no alert, no prediction)"))
    print(BOLD("="*62))
    reinitialiser_systeme_api(mode_nuit=0, statut_vanne="OUVERTE", mode_regime="NORMAL")
    reinitialiser_pred_tracker()

    p1_mesures = [2.0, 1.9, 2.1, 2.0, 2.0, 1.9, 2.1, 2.0, 2.0, 1.9, 2.1, 2.0, 1.9, 2.1, 2.0]
    p1_ok = True

    for i, val in enumerate(p1_mesures, 1):
        print(f"  [Reading {i:02d}/15] Sending flow = {val:.2f} L/min...")
        poster_mesure_api(val)
        time.sleep(0.3)
        res = analyser_une_fois(conn, dry_run=dry_run, verbose=False)
        if res["vanne"] != "OUVERTE" or res["est_pic"] or res["est_micro"] or res["est_mnf"] or res.get("est_pred") or res.get("prediction_active"):
            p1_ok = False

    if p1_ok and res["vanne"] == "OUVERTE":
        resultats["Phase 1"] = "PASS"
        print(VERT("  ✔ Phase 1 passed: no false alert, baseline never triggers prediction, valve remains OPEN."))
    else:
        resultats["Phase 1"] = "FAIL"
        print(ROUGE("  ✘ Phase 1 failed: unexpected alert, prediction or valve closed."))

    # ── Phase 2 : Day, 8 readings 2.8–3.2 L/min -> MICRO_FUITE ───
    print(BOLD("\n" + "="*62))
    print(BOLD("▶ PHASE 2 : Micro-leak (8 readings 2.8–3.2 L/min) -> R5 MICRO_FUITE, valve OPEN"))
    print(BOLD("="*62))
    reinitialiser_systeme_api(mode_nuit=0, statut_vanne="OUVERTE", mode_regime="NORMAL")

    p2_mesures = [2.9, 3.0, 2.8, 3.1, 3.0, 2.9, 3.2, 3.0]
    p2_pic_premiere = False
    p2_micro_detectee = False
    p2_vanne_reste_ouverte = True

    for i, val in enumerate(p2_mesures, 1):
        print(f"  [Reading {i:02d}/08] Sending flow = {val:.2f} L/min...")
        poster_mesure_api(val)
        time.sleep(0.3)
        res = analyser_une_fois(conn, dry_run=dry_run, verbose=False)

        if i == 1:
            p2_pic_premiere = res["est_pic"]
            print(f"     -> First reading check: est_pic = {p2_pic_premiere} (expected: False)")
            assert not p2_pic_premiere, "FAILURE: SPIKE falsely detected on first micro-leak reading!"

        if res["est_micro"]:
            p2_micro_detectee = True

        if res["vanne"] != "OUVERTE":
            p2_vanne_reste_ouverte = False

    if not p2_pic_premiere and p2_micro_detectee and p2_vanne_reste_ouverte and res["vanne"] == "OUVERTE":
        resultats["Phase 2"] = "PASS"
        print(VERT("  ✔ Phase 2 passed: MICRO_FUITE confirmed, no SPIKE on first, valve remains OPEN."))
    else:
        resultats["Phase 2"] = "FAIL"
        print(ROUGE(f"  ✘ Phase 2 failed: spike1={p2_pic_premiere}, micro={p2_micro_detectee}, valve_open={p2_vanne_reste_ouverte}"))

    # ── Phase 3 : Night, 10x 0.1-0.2 then 6x 0.6-0.9 -> MNF ───────
    print(BOLD("\n" + "="*62))
    print(BOLD("▶ PHASE 3 : Night (10x 0.1–0.2 L/min, then 6x 0.6–0.9 L/min) -> R3 MNF, valve CLOSED"))
    print(BOLD("="*62))
    reinitialiser_systeme_api(mode_nuit=1, statut_vanne="OUVERTE", mode_regime="NORMAL")

    p3_baseline = [0.15, 0.18, 0.12, 0.16, 0.14, 0.19, 0.13, 0.17, 0.15, 0.12]
    p3_fuite    = [0.70, 0.80, 0.65, 0.75, 0.85, 0.70]

    for i, val in enumerate(p3_baseline, 1):
        print(f"  [Night Base {i:02d}/10] Flow = {val:.2f} L/min...")
        poster_mesure_api(val)
        time.sleep(0.2)
        analyser_une_fois(conn, dry_run=dry_run, verbose=False)

    p3_mnf_detectee = False
    p3_post_fermee_ok = True
    for i, val in enumerate(p3_fuite, 1):
        print(f"  [Night Leak {i:02d}/06] Flow = {val:.2f} L/min...")
        if i == 6:
            time.sleep(0.5)
        resp = poster_mesure_api(val)
        time.sleep(0.3)
        res = analyser_une_fois(conn, dry_run=dry_run, verbose=False)
        if res["est_mnf"]:
            p3_mnf_detectee = True
        if i == 6:
            print(f"     -> Post-shutoff [Reading {i:02d}]: stored flow = {resp.get('debit_eau')} L/min, avoided flow = {resp.get('debit_evite')} L/min | valve = {resp.get('statut_vanne')}")
            if resp.get('debit_eau') != 0.0 or resp.get('debit_evite') != val or resp.get('statut_vanne') != 'FERMEE':
                p3_post_fermee_ok = False

    telemetrie_p3 = lire_donnees_api()
    eau_eco_p3 = telemetrie_p3.get("stats", {}).get("eau_economisee", 0.0)
    print(CYAN(f"     -> [lire_donnees.php] Phase 3 water saved calculated: {eau_eco_p3} L"))

    if p3_mnf_detectee and res["vanne"] == "FERMEE" and p3_post_fermee_ok:
        resultats["Phase 3"] = "PASS"
        print(VERT("  ✔ Phase 3 passed: MNF detected, valve CLOSED and physical rule verified (stored flow=0, avoided flow>0)."))
    else:
        resultats["Phase 3"] = "FAIL"
        print(ROUGE(f"  ✘ Phase 3 failed: mnf={p3_mnf_detectee}, valve={res['vanne']} (expected: FERMEE), post_ok={p3_post_fermee_ok}"))

    # ── Phase 4 : Day, Valve reopened, 8.5, 9.1, 8.8 -> RUPTURE ─
    print(BOLD("\n" + "="*62))
    print(BOLD("▶ PHASE 4 : Pipe burst (8.5, 9.1, 8.8 L/min) -> R1 RUPTURE at 3rd reading, valve CLOSED"))
    print(BOLD("="*62))
    reinitialiser_systeme_api(mode_nuit=0, statut_vanne="OUVERTE", mode_regime="NORMAL")

    p4_mesures = [8.5, 9.1, 8.8]
    p4_vannes_php = []

    for i, val in enumerate(p4_mesures, 1):
        print(f"  [Burst Reading {i}/3] Sending flow = {val:.2f} L/min...")
        resp_php = poster_mesure_api(val)
        p4_vannes_php.append(resp_php.get("statut_vanne"))
        time.sleep(0.3)
        res = analyser_une_fois(conn, dry_run=dry_run, verbose=False)
        print(f"     -> PHP valve response: {resp_php.get('statut_vanne')} | alert: {resp_php.get('type_alerte')}")

    print(BOLD("  ▶ Readings sent after automatic closure (valve CLOSED):"))
    p4_post = [8.8, 8.5]
    p4_post_ok = True
    for i, val in enumerate(p4_post, 1):
        time.sleep(0.5)
        print(f"  [Post-shutoff {i}/2] Sending flow = {val:.2f} L/min...")
        resp_post = poster_mesure_api(val)
        debit_stocke = resp_post.get("debit_eau")
        debit_evite  = resp_post.get("debit_evite")
        print(f"     -> PHP response: stored flow = {debit_stocke} L/min | avoided flow = {debit_evite} L/min | valve = {resp_post.get('statut_vanne')}")
        if debit_stocke != 0.0 or debit_evite != val or resp_post.get("statut_vanne") != "FERMEE":
            p4_post_ok = False
        res = analyser_une_fois(conn, dry_run=dry_run, verbose=False)

    telemetrie_p4 = lire_donnees_api()
    eau_eco_p4 = telemetrie_p4.get("stats", {}).get("eau_economisee", 0.0)
    print(CYAN(f"     -> [lire_donnees.php] Cumulative water saved Phase 4: {eau_eco_p4} L"))

    p4_ok = (
        p4_vannes_php[0] == "OUVERTE" and
        p4_vannes_php[1] == "OUVERTE" and
        p4_vannes_php[2] == "FERMEE" and
        res["vanne"] == "FERMEE" and
        p4_post_ok
    )

    if p4_ok:
        resultats["Phase 4"] = "PASS"
        print(VERT("  ✔ Phase 4 passed: Valve OPEN for readings 1 and 2, CLOSED on 3rd (RUPTURE), post-shutoff compliant (stored flow=0, avoided flow>0)."))
    else:
        resultats["Phase 4"] = "FAIL"
        print(ROUGE(f"  ✘ Phase 4 failed: valve history={p4_vannes_php}, post_ok={p4_post_ok}"))

    # ── Phase 5 : Day, 14 rising readings 1.0 to 2.4 L/min -> R6 PREDICTION
    print(BOLD("\n" + "="*62))
    print(BOLD("▶ PHASE 5 : Leak prediction (14 rising readings 1.0 -> 2.4 L/min) -> R6 PREDICTION"))
    print(BOLD("="*62))
    reinitialiser_systeme_api(mode_nuit=0, statut_vanne="OUVERTE", mode_regime="NORMAL")
    reinitialiser_pred_tracker()
    with conn.cursor() as cur:
        cur.execute("UPDATE etat_systeme SET prediction_active = 0, prediction_depuis = NULL, prediction_eta_min = NULL, prediction_pente = NULL WHERE id = 1")
        cur.execute("SELECT COUNT(*) AS c FROM notifications_log WHERE canal = 'TELEGRAM'")
        notif_avant_p5 = cur.fetchone()["c"]
    conn.commit()

    base_p5 = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.1, 2.2, 2.3]
    noise_p5 = [0.01, -0.02, 0.02, -0.01, 0.03, -0.02, 0.01, -0.03, 0.02, -0.01, 0.02, -0.02, 0.01, -0.01]
    p5_mesures = [round(b + n, 2) for b, n in zip(base_p5, noise_p5)]

    p5_ok = True
    p5_pred_count = 0
    p5_r4_fired = False
    p5_r5_fired = False

    for i, val in enumerate(p5_mesures, 1):
        print(f"  [Rising {i:02d}/14] Sending flow = {val:.2f} L/min...")
        poster_mesure_api(val)
        time.sleep(0.3)
        res = analyser_une_fois(conn, dry_run=dry_run, verbose=False)

        if res["est_pic"]:
            p5_r4_fired = True
        if res["est_micro"]:
            p5_r5_fired = True
        if res["vanne"] != "OUVERTE" or res["etat_alerte"] != "NORMAL":
            p5_ok = False
        if res.get("est_pred"):
            p5_pred_count += 1
            print(CYAN(f"     -> Reading {i:02d}: PREDICTION condition matched! (ETA: {res.get('eta_min'):.1f} min)"))

    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS c FROM notifications_log WHERE canal = 'TELEGRAM'")
        notif_apres_p5_rising = cur.fetchone()["c"]
        cur.execute("SELECT message FROM notifications_log WHERE canal = 'TELEGRAM' ORDER BY id DESC LIMIT 1")
        dernier_msg_row = cur.fetchone()
        dernier_msg = dernier_msg_row["message"] if dernier_msg_row else ""
    telegram_rows_added = notif_apres_p5_rising - notif_avant_p5

    print(CYAN(f"     -> New TELEGRAM notifications logged during rising: {telegram_rows_added} (expected: 1)"))
    print(CYAN(f"     -> System state: {res['etat_alerte']} (expected: NORMAL), valve: {res['vanne']} (expected: OUVERTE)"))

    if telegram_rows_added != 1 or p5_r4_fired or p5_r5_fired or not p5_ok:
        p5_ok = False

    # 5 flat readings at 1.5 -> prediction_active = 0
    print(BOLD("  ▶ 5 flat readings at 1.5 L/min -> trend stops, prediction_active -> 0:"))
    p5_flat = [1.5, 1.5, 1.5, 1.5, 1.5]
    for i, val in enumerate(p5_flat, 1):
        print(f"  [Flat {i}/5] Sending flow = {val:.2f} L/min...")
        poster_mesure_api(val)
        time.sleep(0.3)
        res = analyser_une_fois(conn, dry_run=dry_run, verbose=False)

    etat_apres_flat = lire_etat_systeme(conn)
    pred_active_apres_flat = etat_apres_flat.get("prediction_active", False)
    print(CYAN(f"     -> After 5 flat readings: prediction_active = {pred_active_apres_flat} (expected: False/0)"))

    if pred_active_apres_flat:
        p5_ok = False

    if p5_ok and telegram_rows_added == 1 and not p5_r4_fired and not p5_r5_fired and not pred_active_apres_flat:
        resultats["Phase 5"] = "PASS"
        print(VERT("  ✔ Phase 5 passed: Exactly 1 PREDICTION Telegram sent, state stayed NORMAL, valve remained OPEN, R4/R5 silent, prediction_active reset to 0 after flat readings."))
    else:
        resultats["Phase 5"] = "FAIL"
        print(ROUGE(f"  ✘ Phase 5 failed: ok={p5_ok}, notifs={telegram_rows_added}, r4={p5_r4_fired}, r5={p5_r5_fired}, pred_active={pred_active_apres_flat}"))

    # ── Phase 6 : Flow Control (Régimes & Modulation d'ouverture) ─
    print(BOLD("\n" + "="*62))
    print(BOLD("▶ PHASE 6 : Flow Control (ECO_NUIT, EVENEMENT, Manual opening, Auto)"))
    print(BOLD("="*62))
    p6_ok = True

    # (a) night + ECO_NUIT, POST 1.0 -> stored debit_eau 0.6, debit_evite 0.4, ouverture 60
    print(BOLD("\n  Sub-test 6(a): Night + ECO_NUIT -> POST 1.0 -> stored flow 0.6, avoided 0.4, opening 60%"))
    reinitialiser_systeme_api(mode_nuit=1, statut_vanne="OUVERTE", mode_regime="ECO_NUIT", ouverture_manuelle=None)
    resp_6a = poster_mesure_api(1.0)
    print(f"     -> Response: stored flow = {resp_6a.get('debit_eau')}, avoided = {resp_6a.get('debit_evite')}, opening = {resp_6a.get('ouverture_pct')}%, regime = {resp_6a.get('regime')}")
    
    with conn.cursor() as cur:
        cur.execute("SELECT debit_eau, debit_evite, debit_brut, ouverture_pct FROM consommation ORDER BY id DESC LIMIT 1")
        row_6a = cur.fetchone()

    sub_6a_ok = (
        round(float(row_6a["debit_eau"]), 1) == 0.6 and
        round(float(row_6a["debit_evite"]), 1) == 0.4 and
        int(row_6a["ouverture_pct"]) == 60 and
        int(resp_6a.get("ouverture_pct", 0)) == 60
    )
    if sub_6a_ok:
        print(VERT("     ✔ Sub-test 6(a) PASS: Night throttling reduced flow to 60% (delivered 0.6, saved 0.4 L/min)."))
    else:
        p6_ok = False
        print(ROUGE(f"     ✘ Sub-test 6(a) FAIL: DB={row_6a}, resp={resp_6a}"))

    # (b) day + EVENEMENT, 8 readings at 3.5 -> no alert, valve open (in NORMAL, gives MICRO_FUITE)
    print(BOLD("\n  Sub-test 6(b): Day + EVENEMENT -> 8 readings at 3.5 L/min -> no alert, valve open"))
    reinitialiser_systeme_api(mode_nuit=0, statut_vanne="OUVERTE", mode_regime="EVENEMENT", ouverture_manuelle=None)
    sub_6b_alert_fired = False
    for i in range(1, 9):
        resp_b = poster_mesure_api(3.5)
        time.sleep(0.2)
        res_b = analyser_une_fois(conn, dry_run=dry_run, verbose=False)
        if res_b["est_micro"] or res_b["vanne"] != "OUVERTE" or res_b["etat_alerte"] != "NORMAL":
            sub_6b_alert_fired = True

    sub_6b_ok = not sub_6b_alert_fired and res_b["vanne"] == "OUVERTE" and res_b["etat_alerte"] == "NORMAL"
    if sub_6b_ok:
        print(VERT("     ✔ Sub-test 6(b) PASS: Peak demand accommodated (threshold relaxed to 7.5 L/min, no false micro-leak)."))
    else:
        p6_ok = False
        print(ROUGE(f"     ✘ Sub-test 6(b) FAIL: alert_fired={sub_6b_alert_fired}, valve={res_b['vanne']}, state={res_b['etat_alerte']}"))

    # (c) EVENEMENT, 3 x 9.0 -> R1 still closes the valve
    print(BOLD("\n  Sub-test 6(c): EVENEMENT mode -> 3 x 9.0 L/min -> R1 still closes the valve (safety first)"))
    reinitialiser_systeme_api(mode_nuit=0, statut_vanne="OUVERTE", mode_regime="EVENEMENT", ouverture_manuelle=None)
    sub_6c_closed = False
    for i in range(1, 4):
        resp_c = poster_mesure_api(9.0)
        time.sleep(0.2)
        res_c = analyser_une_fois(conn, dry_run=dry_run, verbose=False)
        print(f"     -> Reading {i}/3: flow = 9.0 L/min, valve = {resp_c.get('statut_vanne')}, alert = {resp_c.get('type_alerte')}")
        if resp_c.get("statut_vanne") == "FERMEE":
            sub_6c_closed = True

    sub_6c_ok = sub_6c_closed and res_c["vanne"] == "FERMEE"
    if sub_6c_ok:
        print(VERT("     ✔ Sub-test 6(c) PASS: Pipe burst safety rule (R1) overrides event mode and shuts valve."))
    else:
        p6_ok = False
        print(ROUGE(f"     ✘ Sub-test 6(c) FAIL: sub_6c_closed={sub_6c_closed}, valve={res_c['vanne']}"))

    # (d) manual opening 30%, POST 5.0 -> debit_eau 1.5
    print(BOLD("\n  Sub-test 6(d): Manual opening override 30% -> POST 5.0 L/min -> delivered flow = 1.5 L/min"))
    reinitialiser_systeme_api(mode_nuit=0, statut_vanne="OUVERTE", mode_regime="NORMAL", ouverture_manuelle=30)
    resp_6d = poster_mesure_api(5.0)
    print(f"     -> Response: demand = {resp_6d.get('debit_brut')}, delivered = {resp_6d.get('debit_eau')}, avoided = {resp_6d.get('debit_evite')}, opening = {resp_6d.get('ouverture_pct')}%")
    
    with conn.cursor() as cur:
        cur.execute("SELECT debit_eau, debit_evite, debit_brut, ouverture_pct FROM consommation ORDER BY id DESC LIMIT 1")
        row_6d = cur.fetchone()

    sub_6d_ok = (
        round(float(row_6d["debit_eau"]), 1) == 1.5 and
        int(row_6d["ouverture_pct"]) == 30 and
        int(resp_6d.get("ouverture_pct", 0)) == 30
    )
    if sub_6d_ok:
        print(VERT("     ✔ Sub-test 6(d) PASS: Manual override enforced (5.0 x 30% = 1.5 L/min delivered)."))
    else:
        p6_ok = False
        print(ROUGE(f"     ✘ Sub-test 6(d) FAIL: DB={row_6d}, resp={resp_6d}"))

    # (e) back to NORMAL/auto
    print(BOLD("\n  Sub-test 6(e): Back to NORMAL / auto -> ouverture_manuelle cleared -> opening 100%"))
    reinitialiser_systeme_api(mode_nuit=0, statut_vanne="OUVERTE", mode_regime="NORMAL", ouverture_manuelle=None)
    with conn.cursor() as cur:
        cur.execute("SELECT mode_regime, ouverture_manuelle, ouverture_pct FROM etat_systeme WHERE id = 1")
        row_6e = cur.fetchone()

    sub_6e_ok = (
        row_6e["mode_regime"] == "NORMAL" and
        row_6e["ouverture_manuelle"] is None and
        int(row_6e["ouverture_pct"]) == 100
    )
    if sub_6e_ok:
        print(VERT("     ✔ Sub-test 6(e) PASS: Restored to NORMAL regime and 100% automatic opening."))
    else:
        p6_ok = False
        print(ROUGE(f"     ✘ Sub-test 6(e) FAIL: state={row_6e}"))

    if p6_ok:
        resultats["Phase 6"] = "PASS"
        print(VERT("\n  ✔ Phase 6 passed: All Flow Control sub-tests (a through e) passed successfully!"))
    else:
        resultats["Phase 6"] = "FAIL"
        print(ROUGE("\n  ✘ Phase 6 failed: One or more flow control sub-tests failed."))

    conn.close()

    # ── Synthèse finale des résultats ─────────────────────────────
    print("\n" + CYAN("="*62))
    print(CYAN("  HydroMind DETECTOR VALIDATION RESULTS:"))
    print(CYAN("="*62))
    toutes_validees = True
    for phase, statut in resultats.items():
        if statut == "PASS":
            c_stat = VERT("[PASS]")
        else:
            c_stat = ROUGE("[FAIL]")
            toutes_validees = False
        print(f"  {phase:<40} : {c_stat}")
    print(CYAN("="*62) + "\n")

    if toutes_validees:
        print(VERT("🎉 ALL 6 PHASES VALIDATED SUCCESSFULLY!\n"))
    else:
        print(ROUGE("⚠️ FAILURES DETECTED DURING VALIDATION.\n"))


# =============================================================================
#  BOUCLE CONTINUE avec arrêt propre sur Ctrl+C
# =============================================================================

_running = True

def _handler_stop(sig, frame):
    global _running
    print(ORANGE("\n\n  [Signal] Stop requested. Clean shutdown..."))
    _running = False


def boucle_continue(dry_run=False):
    signal.signal(signal.SIGINT, _handler_stop)

    print(CYAN("\n╔══════════════════════════════════════════════════════╗"))
    print(CYAN("║     HydroMind -- AI Detector (continuous loop)       ║"))
    print(CYAN(f"║    Interval: {INTERVALLE_BOUCLE_S} s  |  Ctrl+C to stop            ║"))
    print(CYAN("╚══════════════════════════════════════════════════════╝\n"))

    conn = None
    cycle = 0

    while _running:
        cycle += 1
        try:
            if conn is None or not conn.open:
                print(GRIS(f"  [MySQL] Connecting..."))
                conn = connecter_mysql()
                print(VERT(f"  [MySQL] Connected to {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}"))

            conn.ping(reconnect=True)
            analyser_une_fois(conn, dry_run=dry_run, verbose=True)

        except ConnectionError as e:
            print(ROUGE(f"\n  [MySQL] Connection failed: {e}"))
            print(GRIS(f"  Retrying in {INTERVALLE_BOUCLE_S} s..."))
            conn = None

        except Exception as e:
            print(ROUGE(f"\n  [Unexpected ERROR] Cycle {cycle} : {e}"))
            import traceback
            traceback.print_exc()

        if _running:
            time.sleep(INTERVALLE_BOUCLE_S)

    if conn and conn.open:
        conn.close()
    print(VERT("\n  [END] AI detector stopped cleanly. Goodbye!"))


# =============================================================================
#  POINT D'ENTRÉE CLI
# =============================================================================

def main():
    global FENETRE_ANALYSE, INTERVALLE_BOUCLE_S

    parser = argparse.ArgumentParser(
        description="HydroMind -- Intelligent Leak Detector & Flow Control (AI Phase C)",
        formatter_class=argparse.RawTextHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python detecteur_fuite.py              # Continuous loop (Ctrl+C)\n"
            "  python detecteur_fuite.py --once       # Single analysis\n"
            "  python detecteur_fuite.py --dry-run    # Read-only, no action\n"
            "  python detecteur_fuite.py --test       # 6-phase test scenario\n"
        ),
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Read-only: analyze without closing valve or calling signaler_anomalie.php."
    )
    parser.add_argument(
        "--once", action="store_true",
        help="Perform a single analysis then exit."
    )
    parser.add_argument(
        "--test", action="store_true",
        help="Run the full 6-phase validation protocol."
    )
    parser.add_argument(
        "--fenetre", type=int, default=FENETRE_ANALYSE, metavar="N",
        help=f"Analysis window size in readings (default: {FENETRE_ANALYSE})."
    )
    parser.add_argument(
        "--intervalle", type=float, default=INTERVALLE_BOUCLE_S, metavar="S",
        help=f"Interval between loop analyses in seconds (default: {INTERVALLE_BOUCLE_S})."
    )

    args = parser.parse_args()

    FENETRE_ANALYSE     = args.fenetre
    INTERVALLE_BOUCLE_S = args.intervalle

    if args.dry_run:
        print(ORANGE("\n  [DRY-RUN MODE] No update or shutoff request sent.\n"))

    if args.test:
        mode_test(dry_run=args.dry_run)
        return

    if args.once:
        try:
            conn = connecter_mysql()
            print(VERT(f"  [MySQL] Connected to {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}"))
        except ConnectionError as e:
            print(ROUGE(f"\n  [ERROR] {e}"))
            print(GRIS("  Check that XAMPP (MySQL) is running."))
            sys.exit(1)
        analyser_une_fois(conn, dry_run=args.dry_run, verbose=True)
        conn.close()
        return

    boucle_continue(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
