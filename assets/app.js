// ============================================================
//  HydroMind — assets/app.js
//  Logique temps réel : fetch API toutes les 2 s
//  Design intégral de la coéquipière (style.css intact)
//  Compte technicien & préférences de notifications (SMS vs Telegram)
// ============================================================

'use strict';

// ── Configuration ─────────────────────────────────────────────
const CONFIG = {
  API_LIRE:     'lire_donnees.php',
  API_CONTROLE: 'controler_vanne.php',
  API_DEBIT:    'controler_debit.php',
  API_AUTH:     'auth.php',
  API_PREFS:    'update_preferences.php',
  API_NOTIF:    'notifier.php',
  API_LOGOUT:   'logout.php',
  REFRESH_MS:   2000,
};

const ALERT_TYPE_LABELS = {
  RUPTURE:     'Pipe burst',
  MNF:         'Night leak (Minimum Night Flow)',
  MICRO_FUITE: 'Micro-leak (slow seepage)',
  PIC:         'Sudden flow spike',
  DEPASSEMENT: 'Flow above threshold',
};

function formatAlertType(type) {
  if (!type) return '';
  const enLabel = ALERT_TYPE_LABELS[type] || type;
  return window.KizunaI18n ? window.KizunaI18n.t(enLabel) : enLabel;
}

function formatTimeSince(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(date.getTime())) return dateStr;
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  const isJp = window.KizunaI18n?.getLanguage() === 'jp';
  if (diffSec < 60) return isJp ? `${diffSec}秒前` : `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return isJp ? `${diffMin}分前` : `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  const remMin = diffMin % 60;
  if (isJp) {
    return remMin > 0 ? `${diffH}時間${remMin}分前` : `${diffH}時間前`;
  }
  return remMin > 0 ? `${diffH}h ${remMin}m ago` : `${diffH}h ago`;
}

// Capteurs : Sector A = LIVE (données réelles), B/C/D = simulés
const MAP_CONFIG = {
  CENTER:       [34.8, 9.7],   // Vue nationale Tunisie
  ZOOM:         6,
  ZOOM_ALERT:   13,            // Zoom sur la zone de fuite
  ALERT_RADIUS: 400,           // Cercle d'alerte en mètres
  TILES: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  ATTR:  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  SENSORS: [
    { id: 'center', label: 'Sector A — ESPRIT Zone / El Ghazala', lat: 36.8990, lng: 10.1895, live: true },
    { id: 'north',  label: 'Sector B — Greater Tunis · Sidi Thabet', lat: 36.8065, lng: 10.1815, live: false, debit: 2.3 },
    { id: 'capbon', label: 'Sector C — Cap Bon · Nabeul',           lat: 36.4513, lng: 10.7357, live: false, debit: 3.1 },
    { id: 'south',  label: 'Sector D — Sahel · Sousse',             lat: 35.8256, lng: 10.6369, live: false, debit: 1.8 },
  ],
};

// ── État interne ──────────────────────────────────────────────
const appState = { chart: null, timer: null, lastValveStatus: null };

const mapState = {
  map:              null,
  markers:          {},
  circleA:          null,
  lastEtatAlerte:   null,     // état précédent — détecte les transitions NORMAL / ALERTE / FERMEE
  selectedSensorId: 'center', // Secteur A par défaut
  isAcknowledged:   false,
  lastLiveData:     null,
};

const authState = {
  worker: null,
};

const historyState = {
  isPaused: false,
  pausedSnapshotMaxId: null,
  pausedNewReadingsCount: 0,
  lastKnownMesures: [],
  renderedIds: new Set(),
  initialized: false,
};

// ── Helpers DOM ───────────────────────────────────────────────
const $   = id => document.getElementById(id);
const set = (id, v)  => { const e = $(id); if (e) e.textContent = v; };
const htm = (id, v)  => { const e = $(id); if (e) e.innerHTML   = v; };

function getInitials(name) {
  if (!name) return 'TK';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ── Date ──────────────────────────────────────────────────────
function updateDate() {
  const el = $('todayDate');
  if (!el) return;
  const isJp = window.KizunaI18n?.getLanguage() === 'jp';
  el.textContent = new Intl.DateTimeFormat(isJp ? 'ja-JP' : 'en-US', isJp ? {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
  } : {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date());
}

// ════════════════════════════════════════════════════════════
//  MISE À JOUR UI — données réelles
// ════════════════════════════════════════════════════════════

/** Applique l'état de la vanne à tous les éléments visuels. */
function applyValveUI(open, etatAlerte, typeAlerte, lastDebitEvite, eauEconomisee, alerteDepuis, ouverturePct = 100, modeRegime = 'NORMAL', ouvertureManuelle = null) {
  const t = (k, p) => window.KizunaI18n ? window.KizunaI18n.t(k, p) : k;

  const isClosed = !open || ouverturePct === 0;
  set('valveValue', isClosed ? t('Closed') : (ouverturePct < 100 ? `${ouverturePct}%` : t('Open')));

  const foot = $('valveFoot');
  if (foot) {
    foot.textContent = !isClosed ? ('● ' + t('Normal operation')) : ('● ' + t('Flow interrupted'));
    foot.className   = !isClosed ? 'stat-positive' : 'stat-danger';
  }

  const typeLabel = formatAlertType(typeAlerte);

  let regimeLabel = t('Normal');
  if (ouvertureManuelle !== null && ouvertureManuelle !== undefined) {
    regimeLabel = t('Manual');
  } else if (modeRegime === 'ECO_NUIT') {
    regimeLabel = t('Night eco');
  } else if (modeRegime === 'EVENEMENT') {
    regimeLabel = t('Event mode');
  }

  if (etatAlerte === 'FERMEE' || isClosed) {
    if (etatAlerte === 'FERMEE') {
      const timeSince = formatTimeSince(alerteDepuis);
      set('valveState', t('Leak confirmed – valve closed automatically'));
      set('valveDescription', typeLabel
        ? (timeSince ? t('{type} · Closed {time}.', { type: typeLabel, time: timeSince }) : t('{type} · Valve closed automatically.', { type: typeLabel }))
        : t('Water circulation is currently interrupted.'));
    } else {
      set('valveState', t('Valve closed'));
      set('valveDescription', t('Water circulation is currently interrupted.'));
    }
  } else if (etatAlerte === 'ALERTE') {
    set('valveState', t('Anomaly detected – valve open, monitoring'));
    set('valveDescription', typeLabel
      ? t('{type} · Active monitoring in progress.', { type: typeLabel })
      : t('Water is flowing under surveillance.'));
  } else {
    // Normal / Eco / Event / Manual: e.g. "Valve 60% open (Night eco)"
    set('valveState', t('Valve {pct}% open ({regime})', { pct: ouverturePct, regime: regimeLabel }));
    set('valveDescription', t("Water is flowing normally through the network."));
  }

  // Water saved badge
  const badgeEl = $('waterSavedBadge');
  if (badgeEl) {
    const savedNum = Number(eauEconomisee || 0).toFixed(1);
    const eviteNum = Number(lastDebitEvite || 0).toFixed(1);
    if (lastDebitEvite > 0) {
      badgeEl.textContent = t('💧 {saved} L of water saved ({avoided} L/min being saved)', { saved: savedNum, avoided: eviteNum });
    } else {
      badgeEl.textContent = t('💧 {saved} L of water saved', { saved: savedNum });
    }
  }

  $('valveVisual')?.classList.toggle('closed', isClosed);
  set('deviceValveStatus', !isClosed ? t('Online') : t('Closed'));

  if ($('closeValveBtn')) $('closeValveBtn').disabled = isClosed;
  if ($('openValveBtn'))  $('openValveBtn').disabled  = !isClosed;
}

/** Met à jour la bannière d'alerte, les KPI et le panneau des alertes récentes. */
function applyAlertUI(etatAlerte, typeAlerte, debit, alerteDepuis, alertesLog, stats, isOffline = false, secondsOffline = null) {
  const banner = $('alertBanner');
  const typeLabel = formatAlertType(typeAlerte);
  const t = (k, p) => window.KizunaI18n?.t(k, p) || k;

  if (banner) {
    banner.classList.remove('hidden-alert', 'state-normal', 'state-alerte', 'state-fermee', 'state-offline');

    if (isOffline) {
      banner.classList.add('state-offline');
      if (etatAlerte === 'FERMEE') {
        set('bannerTitle', t('Leak confirmed – valve closed automatically'));
        const timeSince = formatTimeSince(alerteDepuis);
        set('bannerText', typeLabel
          ? (timeSince ? t('{type} · Active since {time}.', { type: typeLabel, time: timeSince }) : t('{type} · Automatic emergency shutoff.', { type: typeLabel }))
          : t('Water network closed automatically.'));
        set('bannerTime', t('CRITICAL'));
      } else if (etatAlerte === 'ALERTE') {
        set('bannerTitle', t('Anomaly detected – sensor offline'));
        set('bannerText', typeLabel
          ? t('{type} · Last known flow: {flow} L/min · Telemetry paused.', { type: typeLabel, flow: debit })
          : t('Unusual flow detected: {flow} L/min (last known) · Telemetry paused.', { flow: debit }));
        set('bannerTime', t('OFFLINE'));
      } else {
        set('bannerTitle', t('Sensor offline – live monitoring suspended'));
        set('bannerText', t('Live telemetry paused · Awaiting next sensor transmission.'));
        set('bannerTime', t('OFFLINE'));
      }
    } else {
      if (etatAlerte === 'FERMEE') {
        banner.classList.add('state-fermee');
        set('bannerTitle', t('Leak confirmed – valve closed automatically'));
        const timeSince = formatTimeSince(alerteDepuis);
        set('bannerText', typeLabel
          ? (timeSince ? t('{type} · Active since {time}.', { type: typeLabel, time: timeSince }) : t('{type} · Automatic emergency shutoff.', { type: typeLabel }))
          : t('Water network closed automatically.'));
        set('bannerTime', t('CRITICAL'));
      } else if (etatAlerte === 'ALERTE') {
        banner.classList.add('state-alerte');
        set('bannerTitle', t('Anomaly detected – valve open, monitoring'));
        set('bannerText', typeLabel
          ? t('{type} · Current flow: {flow} L/min.', { type: typeLabel, flow: debit })
          : t('Unusual flow detected: {flow} L/min.', { flow: debit }));
        set('bannerTime', t('MONITORING'));
      } else {
        banner.classList.add('hidden-alert', 'state-normal');
        set('bannerTitle', t('No anomaly detected'));
        set('bannerText', t('Flow is within the normal range.'));
        set('bannerTime', t('JUST NOW'));
      }
    }
  }

  // Nav alert count & KPI card
  const isProblem = etatAlerte === 'FERMEE' || etatAlerte === 'ALERTE';
  set('navAlertCount', isProblem ? '1' : '0');

  const alertCount = (stats && stats.alertes_aujourdhui !== undefined)
    ? String(stats.alertes_aujourdhui).padStart(2, '0')
    : (isProblem ? '01' : '00');
  set('alertValue', alertCount);

  const alertFoot = $('alertFoot');
  if (alertFoot) {
    if (etatAlerte === 'FERMEE') {
      alertFoot.textContent = '● ' + t('Emergency shutoff active');
      alertFoot.className = 'stat-danger';
    } else if (etatAlerte === 'ALERTE') {
      alertFoot.textContent = '● ' + t('Anomaly under surveillance');
      alertFoot.className = 'stat-warning';
    } else {
      alertFoot.textContent = '● ' + t('Monitoring active · Normal');
      alertFoot.className = 'stat-positive';
    }
  }

  // Panneau Recent Alerts (alimenté depuis alertes_log)
  updateRecentAlertsPanel(alertesLog, etatAlerte, typeAlerte, debit);
}

/** Met à jour le badge/chip bleu d'information de prédiction de tendance (R6) sous la bannière. */
function updatePredictionChip(predictionActive, predictionPente, predictionEtaMin, etatAlerte) {
  const chip = $('predictionChip');
  const chipText = $('predictionChipText');
  if (!chip) return;

  const isActive = (predictionActive === 1 || predictionActive === true || predictionActive === '1') && etatAlerte === 'NORMAL';
  if (!isActive) {
    chip.style.display = 'none';
    return;
  }

  const isJp = window.KizunaI18n?.getLanguage() === 'jp';
  const t = (k, p) => window.KizunaI18n?.t(k, p) || k;

  const penteVal = (typeof predictionPente === 'number') ? predictionPente : parseFloat(predictionPente || 0);
  const penteFmt = penteVal.toFixed(2);
  const etaVal = (typeof predictionEtaMin === 'number') ? predictionEtaMin : parseFloat(predictionEtaMin || 0);

  let etaStr;
  if (etaVal < 1.0) {
    const sec = Math.max(1, Math.round(etaVal * 60));
    etaStr = isJp ? `${sec}秒` : `${sec} s`;
  } else {
    const min = Math.round(etaVal);
    etaStr = isJp ? `${min}分` : `${min} min`;
  }

  const text = t('Trend watch: flow rising +{pente} L/min per minute — threshold reachable in ~{eta}', {
    pente: penteFmt,
    eta: etaStr,
  });

  if (chipText) {
    chipText.textContent = text;
  }
  chip.style.display = 'inline-flex';
}

function updateRecentAlertsPanel(alertesLog, currentEtat, currentType, currentDebit) {
  const container = $('alertsList');
  if (!container) return;
  const t = (k, p) => window.KizunaI18n?.t(k, p) || k;

  if (Array.isArray(alertesLog) && alertesLog.length > 0) {
    const itemsHtml = alertesLog.slice(0, 5).map(item => {
      const typeText = formatAlertType(item.type) || item.type || t('Alert');
      const debitVal = parseFloat(item.debit || 0).toFixed(1);
      const timeStr  = item.created_at || t('Today');

      if (item.etat === 'FERMEE') {
        return `<div class="alert-item">
          <span class="alert-type">!</span>
          <div>
            <b>${t('{type} — Valve Closed', { type: typeText })}</b>
            <p>${t('Flow: {flow} L/min — Automatic safety closure', { flow: debitVal })}</p>
            <small>${timeStr}</small>
          </div>
          <span class="severity">${t('CRITICAL')}</span>
        </div>`;
      } else if (item.etat === 'ALERTE') {
        return `<div class="alert-item">
          <span class="alert-type warning">!</span>
          <div>
            <b>${t('{type} — Anomaly', { type: typeText })}</b>
            <p>${t('Flow: {flow} L/min — Under monitoring', { flow: debitVal })}</p>
            <small>${timeStr}</small>
          </div>
          <span class="severity warning-severity">${t('WARNING')}</span>
        </div>`;
      } else {
        return `<div class="alert-item muted-alert">
          <span class="alert-type normal">✓</span>
          <div>
            <b>${t('Valve Reopened — Back to normal')}</b>
            <p>${t('Flow: {flow} L/min — Operational range restored', { flow: debitVal })}</p>
            <small>${timeStr}</small>
          </div>
          <span class="severity normal-severity">${t('RESOLVED')}</span>
        </div>`;
      }
    }).join('');

    container.innerHTML = itemsHtml;
  } else {
    if (currentEtat === 'FERMEE') {
      const typeText = formatAlertType(currentType) || t('Leak confirmed');
      container.innerHTML = `<div class="alert-item">
        <span class="alert-type">!</span>
        <div>
          <b>${t('{type} — Valve Closed', { type: typeText })}</b>
          <p>${t('Flow: {flow} L/min — Automatic safety closure', { flow: currentDebit })}</p>
          <small>${t('Today · Active')}</small>
        </div>
        <span class="severity">${t('CRITICAL')}</span>
      </div>`;
    } else if (currentEtat === 'ALERTE') {
      const typeText = formatAlertType(currentType) || t('Anomaly detected');
      container.innerHTML = `<div class="alert-item">
        <span class="alert-type warning">!</span>
        <div>
          <b>${t('{type} — Under monitoring', { type: typeText })}</b>
          <p>${t('Flow: {flow} L/min — Surveillance in progress', { flow: currentDebit })}</p>
          <small>${t('Today · Active')}</small>
        </div>
        <span class="severity warning-severity">${t('WARNING')}</span>
      </div>`;
    } else {
      container.innerHTML = `<div class="alert-item muted-alert">
        <span class="alert-type info">i</span>
        <div>
          <b>${t('Monitoring active')}</b>
          <p>${t('Sensors are successfully transmitting measurements')}</p>
          <small>${t('Today · Continuous')}</small>
        </div>
        <span class="severity info-severity">${t('INFO')}</span>
      </div>`;
    }
  }
}

/** Synchronise le bouton Mode Nuit avec l'état BDD. */
function applyNightUI(isNight) {
  const btn = $('nightModeBtn');
  if (!btn) return;
  const jp = window.KizunaI18n?.getLanguage() === 'jp';
  btn.textContent = jp
    ? (isNight ? '🌙 ナイトモード：オン' : '☀️ ナイトモード：オフ')
    : (isNight ? '🌙 Night Mode: ON' : '☀️ Night Mode: OFF');
  btn.classList.toggle('night-active', isNight);
}

/** Met à jour les 4 cartes KPI depuis les données réelles. */
function applyStats(data) {
  const mesures  = data.mesures || [];
  const derniere = mesures.length ? mesures[mesures.length - 1] : null;
  if (!derniere) return;

  const debit         = parseFloat(derniere.debit_eau);
  const debitEvite    = parseFloat(derniere.debit_evite || 0);
  const isOpen        = data.statut_vanne === 'OUVERTE';
  const etatAlerte    = data.etat_alerte || 'NORMAL';
  const typeAlerte    = data.type_alerte || null;
  const alerteDepuis  = data.alerte_depuis || null;
  const eauEconomisee = (data.stats && data.stats.eau_economisee !== undefined) ? Number(data.stats.eau_economisee) : 0;
  const consoJour     = (data.stats && data.stats.consommation_jour !== undefined) ? Number(data.stats.consommation_jour) : 0;
  const t             = (k, p) => window.KizunaI18n?.t(k, p) || k;

  // Débit actuel
  set('flowValue', debit.toFixed(1));
  htm('chartCurrent', `${debit.toFixed(1)} <small>L/min</small>`);

  // Sensor offline status calculation from SQL TIMESTAMPDIFF
  const secondsOffline = typeof data.seconds_since_last_reading === 'number'
    ? data.seconds_since_last_reading
    : (data.stats && typeof data.stats.seconds_since_last_reading === 'number' ? data.stats.seconds_since_last_reading : null);
  const isOffline = (secondsOffline !== null && secondsOffline > 10);

  // Sensor status badge & flow card label
  const sensorBadge = $('sensorStatusBadge');
  const flowFoot = $('flowFoot');
  const lastKnownTag = $('flowLastKnownTag');

  if (sensorBadge) {
    if (isOffline) {
      sensorBadge.className = 'sensor-status-badge offline';
      sensorBadge.textContent = t('Sensor offline — last reading {sec} s ago', { sec: secondsOffline ?? 0 });
    } else {
      sensorBadge.className = 'sensor-status-badge online';
      sensorBadge.textContent = t('Sensor online');
    }
  }

  if (flowFoot) {
    flowFoot.textContent = isOffline ? ('● ' + t('last known')) : ('● ' + t('Live measurement'));
  }
  if (lastKnownTag) {
    lastKnownTag.style.display = isOffline ? 'inline-block' : 'none';
    lastKnownTag.textContent = t('(last known)');
  }

  // Consommation réelle aujourd'hui (sans floor 200 L)
  set('consumptionValue', consoJour.toFixed(1));

  // Eau économisée KPI
  if (!isOpen && debitEvite > 0) {
    set('waterSavedMetric', t('💧 {saved} L ({avoided} L/min saved)', { saved: eauEconomisee.toFixed(1), avoided: debitEvite.toFixed(1) }));
  } else {
    set('waterSavedMetric', t('💧 {saved} L', { saved: eauEconomisee.toFixed(1) }));
  }

  const ouverturePct      = (data.ouverture_pct !== undefined && data.ouverture_pct !== null) ? parseInt(data.ouverture_pct, 10) : (isOpen ? 100 : 0);
  const modeRegime        = data.mode_regime || 'NORMAL';
  const ouvertureManuelle = (data.ouverture_manuelle !== undefined && data.ouverture_manuelle !== null) ? parseInt(data.ouverture_manuelle, 10) : null;
  const debitBrut         = (data.debit_brut !== undefined && data.debit_brut !== null) ? parseFloat(data.debit_brut) : (debit + debitEvite);
  const isManual          = (ouvertureManuelle !== null);

  applyValveUI(isOpen, etatAlerte, typeAlerte, debitEvite, eauEconomisee, alerteDepuis, ouverturePct, modeRegime, ouvertureManuelle);

  // Mise à jour de la carte Contrôle de débit
  set('gaugeOpeningText', t('Valve opening: {pct}%', { pct: ouverturePct }));
  const gaugeFill = $('gaugeOpeningFill');
  if (gaugeFill) gaugeFill.style.width = `${ouverturePct}%`;

  set('gaugeDemandDeliveredText', t('Demand {demand} → Delivered {delivered} L/min', {
    demand: debitBrut.toFixed(1),
    delivered: debit.toFixed(1)
  }));

  set('flowRegimeBadgeText', t(modeRegime));

  $('regimeNormalBtn')?.classList.toggle('active', modeRegime === 'NORMAL' && !isManual);
  $('regimeEcoBtn')?.classList.toggle('active', modeRegime === 'ECO_NUIT' && !isManual);
  $('regimeEventBtn')?.classList.toggle('active', modeRegime === 'EVENEMENT' && !isManual);

  const isEvent = (modeRegime === 'EVENEMENT');
  const durBox = $('eventDurationBox');
  if (durBox) durBox.style.display = isEvent ? 'block' : 'none';

  const expEl = $('eventExpiryText');
  if (expEl) {
    if (isEvent && data.evenement_jusqu_a) {
      expEl.textContent = t('Active until {time}', { time: data.evenement_jusqu_a });
      expEl.style.display = 'block';
    } else {
      expEl.style.display = 'none';
    }
  }

  const slider = $('manualOpeningSlider');
  if (slider && !appState.isDraggingSlider) {
    slider.value = isManual ? ouvertureManuelle : (isOpen ? ouverturePct : 100);
    set('manualSliderVal', `${slider.value}%`);
  }

  applyAlertUI(etatAlerte, typeAlerte, debit.toFixed(1), alerteDepuis, data.alertes_log || [], data.stats || {}, isOffline, secondsOffline);
  updatePredictionChip(data.prediction_active, data.prediction_pente, data.prediction_eta_min, etatAlerte);
  appState.lastPrediction = {
    active: data.prediction_active,
    pente: data.prediction_pente,
    eta: data.prediction_eta_min,
    etatAlerte: etatAlerte
  };
  applyNightUI(data.mode_nuit);

  // Détection d'un changement d'état de vanne externe (ex: fermeture automatique)
  if (appState.lastValveStatus && appState.lastValveStatus !== data.statut_vanne) {
    if (data.statut_vanne === 'FERMEE') {
      addActivity(t('Valve closed automatically'), t('Anti-leak protection activated'), 'warning');
    } else if (data.statut_vanne === 'OUVERTE') {
      addActivity(t('Valve reopened'), t('Normal network operation restored'), 'success');
    }
  }
  appState.lastValveStatus = data.statut_vanne;
}

// ════════════════════════════════════════════════════════════
//  GRAPHIQUE CHART.JS (couleurs du design de la coéquipière)
// ════════════════════════════════════════════════════════════

function initChart() {
  const canvas = $('flowChart');
  if (!canvas || !window.Chart) return;
  const t = (k, p) => window.KizunaI18n?.t(k, p) || k;

  appState.chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label:           t('Delivered flow'),
          data:            [],
          borderColor:     '#159bd0',
          backgroundColor: 'rgba(21,155,208,.10)',
          fill:            true,
          tension:         0.42,
          borderWidth:     2.5,
          pointRadius:     0,
          pointHoverRadius:5,
        },
        {
          label:           t('Demand'),
          data:            [],
          borderColor:     '#8b5cf6',
          borderDash:      [4, 4],
          borderWidth:     1.8,
          pointRadius:     0,
          pointHoverRadius:4,
          fill:            false,
          tension:         0.2,
        },
        {
          label:       t('Alert threshold'),
          data:        [],
          borderColor: '#f2a34a',
          borderDash:  [6, 5],
          borderWidth: 1.5,
          pointRadius: 0,
          fill:        false,
        }
      ]
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction:         { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#102b45',
          padding:         11,
          displayColors:   false,
          callbacks: {
            label: c => `${c.dataset.label}: ${c.parsed.y.toFixed(1)} L/min`
          }
        }
      },
      scales: {
        x: {
          grid:  { display: false },
          ticks: { color: '#9aa9b7', font: { family: 'DM Sans', size: 10 }, maxTicksLimit: 7 }
        },
        y: {
          min: 0,
          max: 25,
          grid:  { color: '#edf1f5' },
          ticks: { color: '#9aa9b7', font: { family: 'DM Sans', size: 10 }, stepSize: 5 }
        }
      }
    }
  });
}

function applyChart(mesures, seuilActif) {
  if (!appState.chart || !mesures) return;

  const t      = (k, p) => window.KizunaI18n?.t(k, p) || k;
  const isJp   = window.KizunaI18n?.getLanguage() === 'jp';
  const locale = isJp ? 'ja-JP' : 'en-US';
  const seuil  = parseFloat(seuilActif) || 5.0;
  const labels = [];
  const valuesDelivered = [];
  const valuesDemand = [];

  mesures.forEach(m => {
    const ts = new Date(m.timestamp.replace(' ', 'T'));
    labels.push(ts.toLocaleTimeString(locale, {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }));
    const del = parseFloat(m.debit_eau);
    valuesDelivered.push(del);
    const brut = (m.debit_brut !== null && m.debit_brut !== undefined)
      ? parseFloat(m.debit_brut)
      : (del + parseFloat(m.debit_evite || 0));
    valuesDemand.push(brut);
  });

  appState.chart.data.labels             = labels;
  appState.chart.data.datasets[0].label  = t('Delivered flow');
  appState.chart.data.datasets[0].data   = valuesDelivered;
  appState.chart.data.datasets[1].label  = t('Demand');
  appState.chart.data.datasets[1].data   = valuesDemand;
  appState.chart.data.datasets[2].label  = t('Alert threshold');
  appState.chart.data.datasets[2].data   = valuesDelivered.map(() => seuil);
  appState.chart.update('none');
}

// ════════════════════════════════════════════════════════════
//  CARTE LEAFLET + divIcon pulsant
// ════════════════════════════════════════════════════════════

/** Injecte les keyframes CSS pour le marqueur pulsant. */
function injectMapCSS() {
  if ($('kz-style')) return;
  const s = document.createElement('style');
  s.id = 'kz-style';
  s.textContent = `
    .kz-wrap{background:transparent!important;border:none!important;box-shadow:none!important}
    .kz-pin{position:relative;width:30px;height:30px;display:flex;align-items:center;justify-content:center}
    .kz-core{width:14px;height:14px;border-radius:50%;border:2.5px solid #fff;
             box-shadow:0 2px 8px rgba(0,0,0,.3);position:absolute;z-index:2}
    .kz-ring{position:absolute;width:14px;height:14px;border-radius:50%;border:2px solid;opacity:0}
    .kz-r1{animation:kzP 1.8s ease-out infinite}
    .kz-r2{animation:kzP 1.8s ease-out .9s infinite}
    @keyframes kzP{0%{transform:scale(1);opacity:.75}100%{transform:scale(5);opacity:0}}
    .leaflet-popup-content-wrapper{border-radius:8px!important;
      box-shadow:0 8px 25px rgba(0,0,0,.12)!important}
    .leaflet-popup-content{margin:12px 14px!important;line-height:1.65!important;
      font-family:'DM Sans',sans-serif!important;font-size:11px!important;color:#122b42}
    #nightModeBtn.night-active{border-color:#087eba;color:#087eba;background:#e9f5fb}
  `;
  document.head.appendChild(s);
}

/** Crée un L.divIcon avec anneaux pulsants optionnels. */
function mkIcon(color, pulsing) {
  const r = pulsing
    ? `<div class="kz-ring kz-r1" style="border-color:${color}"></div>
       <div class="kz-ring kz-r2" style="border-color:${color}"></div>`
    : '';
  return L.divIcon({
    className:   'kz-wrap',
    html:        `<div class="kz-pin">${r}<div class="kz-core" style="background:${color}"></div></div>`,
    iconSize:    [30, 30],
    iconAnchor:  [15, 15],
    popupAnchor: [0, -17],
  });
}

/** Génère le HTML du popup selon le type de capteur et l'état d'alerte. */
function mkPopup(sensor, etatAlerte, typeAlerte, debit, vanne) {
  const F = 'font-family:"DM Sans",sans-serif;min-width:168px';
  const typeLabel = formatAlertType(typeAlerte);
  const t = (k, p) => window.KizunaI18n?.t(k, p) || k;
  const flowLabel = t('Flow');
  const valveLabel = t('Valve');
  const vanneLabel = (vanne === 'CLOSED' || vanne === 'FERMEE') ? t('Closed') : ((vanne === 'OPEN' || vanne === 'OUVERTE') ? t('Open') : vanne);

  if (sensor.live && etatAlerte === 'FERMEE') {
    return `<div style="${F}">
      <strong style="color:#e34d5b">🚨 ${t('LEAK CONFIRMED')}</strong><br>
      <span style="color:#e34d5b;font-size:10px">${sensor.label}${typeLabel ? ' · ' + typeLabel : ''}</span>
      <hr style="border:none;border-top:1px solid #f3d9d8;margin:7px 0">
      ${flowLabel}&nbsp;: <strong style="color:#e34d5b">${debit}&nbsp;L/min</strong><br>
      ${valveLabel}&nbsp;: <strong>${vanneLabel}</strong></div>`;
  }
  if (sensor.live && etatAlerte === 'ALERTE') {
    return `<div style="${F}">
      <strong style="color:#c97a16">⚠️ ${t('ANOMALY DETECTED')}</strong><br>
      <span style="color:#c97a16;font-size:10px">${sensor.label}${typeLabel ? ' · ' + typeLabel : ''}</span>
      <hr style="border:none;border-top:1px solid #faeacc;margin:7px 0">
      ${flowLabel}&nbsp;: <strong style="color:#c97a16">${debit}&nbsp;L/min</strong><br>
      ${valveLabel}&nbsp;: <strong>${vanneLabel}</strong></div>`;
  }
  if (sensor.live) {
    return `<div style="${F}">
      <strong style="color:#087eba">📡 ${sensor.label}</strong><br>
      <span style="color:#20a879;font-size:10px">✅ ${t('Normal · LIVE')}</span>
      <hr style="border:none;border-top:1px solid #e8eef3;margin:7px 0">
      ${flowLabel}&nbsp;: <strong>${debit}&nbsp;L/min</strong><br>
      ${valveLabel}&nbsp;: <span style="color:#20a879">${vanneLabel}</span></div>`;
  }
  return `<div style="${F}">
    <strong style="color:#087eba">📡 ${sensor.label}</strong><br>
    <span style="color:#20a879;font-size:10px">✅ ${t('Simulated — Normal')}</span>
    <hr style="border:none;border-top:1px solid #e8eef3;margin:7px 0">
    ${flowLabel}&nbsp;: <strong>${sensor.debit.toFixed(1)}&nbsp;L/min</strong><br>
    ${valveLabel}&nbsp;: <span style="color:#20a879">${t('Open')}</span></div>`;
}

/**
 * Met à jour la fiche latérale de droite pour le capteur spécifié.
 * @param {string} sensorId - 'center' | 'north' | 'capbon' | 'south'
 * @param {Object|null} liveData - Dernières données reçues de lire_donnees.php
 */
function renderSensorDetailCard(sensorId, liveData) {
  const sensor = MAP_CONFIG.SENSORS.find(s => s.id === sensorId) || MAP_CONFIG.SENSORS[0];
  const card   = $('leakCard') || document.querySelector('.leak-card');
  const ackBtn = $('ackLeakBtn');
  const t      = (k, p) => window.KizunaI18n?.t(k, p) || k;
  const isJp   = window.KizunaI18n?.getLanguage() === 'jp';

  let etatAlerte = 'NORMAL';
  let typeAlerte = null;
  let liveDebit  = '—';
  let liveVanne  = 'OPEN';

  if (liveData && liveData.mesures && liveData.mesures.length) {
    const last = liveData.mesures.at(-1);
    etatAlerte = liveData.etat_alerte || 'NORMAL';
    typeAlerte = liveData.type_alerte || null;
    liveDebit  = parseFloat(last.debit_eau).toFixed(1);
    liveVanne  = liveData.statut_vanne === 'FERMEE' ? 'CLOSED' : 'OPEN';
  }

  set('mapZone',   sensor.label);
  set('mapCoords', `${sensor.lat.toFixed(4)}° N · ${sensor.lng.toFixed(4)}° E`);

  if (sensor.live) {
    // Secteur A — LIVE
    set('mapConfidence', t('LIVE'));
    set('mapSource',     t('LIVE'));
    htm('mapLoss',       `${liveDebit} <em>L/min</em>`);

    card?.classList.remove('acknowledged', 'sensor-card', 'state-alerte');

    const typeLabel = formatAlertType(typeAlerte);

    if (etatAlerte === 'FERMEE') {
      if (mapState.isAcknowledged) {
        set('mapStatus', t('PROCESSING'));
        card?.classList.add('acknowledged');
      } else {
        set('mapStatus', isJp ? `🔴 ${t('LEAK CONFIRMED')}${typeLabel ? ' · ' + typeLabel : ''}` : `🔴 LEAK CONFIRMED${typeLabel ? ' · ' + typeLabel.toUpperCase() : ''}`);
      }
      if (ackBtn) ackBtn.style.display = '';
    } else if (etatAlerte === 'ALERTE') {
      card?.classList.add('state-alerte');
      set('mapStatus', isJp ? `🟠 ${t('ANOMALY DETECTED')}${typeLabel ? ' · ' + typeLabel : ''}` : `🟠 ANOMALY DETECTED${typeLabel ? ' · ' + typeLabel.toUpperCase() : ''}`);
      if (ackBtn) ackBtn.style.display = '';
    } else {
      card?.classList.add('sensor-card');
      set('mapStatus', `🟢 ${t('NORMAL OPERATION')}`);
      if (ackBtn) ackBtn.style.display = 'none';
    }
  } else {
    // Secteur B, C, D — Capteur simulé
    set('mapConfidence', t('SIMULATED'));
    set('mapSource',     t('Simulated sensor'));
    htm('mapLoss',       `${sensor.debit.toFixed(1)} <em>L/min</em>`);
    set('mapStatus',     `🟢 ${t('NORMAL OPERATION')}`);
    card?.classList.remove('acknowledged', 'state-alerte');
    card?.classList.add('sensor-card');
    if (ackBtn) ackBtn.style.display = 'none';
  }
}

/** Sélectionne un capteur, met à jour la fiche et active le marqueur. */
function selectSensor(sensorId, shouldFly = false) {
  mapState.selectedSensorId = sensorId;
  renderSensorDetailCard(sensorId, mapState.lastLiveData);

  const sensor = MAP_CONFIG.SENSORS.find(s => s.id === sensorId);
  const marker = mapState.markers[sensorId];

  if (sensor && shouldFly) {
    mapState.map?.flyTo([sensor.lat, sensor.lng], MAP_CONFIG.ZOOM_ALERT, { duration: 1.2 });
  }
  if (marker && shouldFly) {
    marker.openPopup();
  }
}

/** Initialise la carte Leaflet avec OpenStreetMap + 4 capteurs. */
function initMap() {
  const el = $('tunisiaMap');
  if (!el || !window.L) return;

  mapState.map = L.map(el, { zoomControl: false, scrollWheelZoom: false })
    .setView(MAP_CONFIG.CENTER, MAP_CONFIG.ZOOM);

  L.control.zoom({
    position: 'bottomright',
    zoomInTitle: window.KizunaI18n?.t('Zoom in') || 'Zoom in',
    zoomOutTitle: window.KizunaI18n?.t('Zoom out') || 'Zoom out',
  }).addTo(mapState.map);

  L.tileLayer(MAP_CONFIG.TILES, { attribution: MAP_CONFIG.ATTR, maxZoom: 18 })
    .addTo(mapState.map);

  // Ligne réseau traversant la Tunisie
  L.polyline(
    MAP_CONFIG.SENSORS.map(s => [s.lat, s.lng]),
    { color: '#087eba', weight: 4, opacity: 0.85, dashArray: '8 8' }
  ).addTo(mapState.map);

  // Marqueurs (Sector A en bleu, B/C/D en vert)
  MAP_CONFIG.SENSORS.forEach(s => {
    const color  = s.live ? '#087eba' : '#19aa86';
    const marker = L.marker([s.lat, s.lng], {
      icon:         mkIcon(color, false),
      zIndexOffset: s.live ? 1000 : 0,
    }).addTo(mapState.map);

    // Popup reste ouvert jusqu'à clic utilisateur sur un autre marqueur ou croix de fermeture
    marker.bindPopup(mkPopup(s, 'NORMAL', null, s.debit ?? '—', 'OPEN'), {
      autoClose:    true,
      closeOnClick: false,
    });

    marker.on('click', () => {
      selectSensor(s.id, false);
    });

    mapState.markers[s.id] = marker;
  });

  renderSensorDetailCard('center', null);
  setTimeout(() => mapState.map.invalidateSize(), 150);
}

/** Applique sur la carte l'état reçu depuis l'API. */
function applyMap(data) {
  if (!mapState.map) return;

  const last = data.mesures && data.mesures.length ? data.mesures.at(-1) : null;
  if (!last)  return;

  const etatAlerte = data.etat_alerte || 'NORMAL';
  const typeAlerte = data.type_alerte || null;
  const typeLabel  = formatAlertType(typeAlerte);
  const debit      = parseFloat(last.debit_eau).toFixed(1);
  const vanne      = data.statut_vanne === 'OUVERTE' ? 'OPEN' : 'CLOSED';
  const sA         = MAP_CONFIG.SENSORS.find(s => s.live);

  mapState.lastLiveData = data;
  const t = (k, p) => window.KizunaI18n?.t(k, p) || k;
  const isJp = window.KizunaI18n?.getLanguage() === 'jp';

  // Mise à jour uniquement lors d'un changement d'état d'alerte (transition)
  if (etatAlerte !== mapState.lastEtatAlerte) {
    mapState.lastEtatAlerte = etatAlerte;

    const mA = mapState.markers['center'];

    if (mapState.circleA) {
      mapState.map.removeLayer(mapState.circleA);
      mapState.circleA = null;
    }

    if (etatAlerte === 'FERMEE') {
      if (mA) mA.setIcon(mkIcon('#e34d5b', true));

      mapState.isAcknowledged = false;
      addActivity(
        t('Leak confirmed ({type})', { type: typeLabel || (isJp ? '管路破裂' : 'BURST') }),
        isJp ? `安全閉鎖を実行 · ${debit} L/min` : `Safety closure triggered · ${debit} L/min`,
        'warning'
      );

      mapState.circleA = L.circle([sA.lat, sA.lng], {
        radius:      MAP_CONFIG.ALERT_RADIUS,
        color:       '#e34d5b',
        fillColor:   '#e34d5b',
        fillOpacity: 0.12,
        weight:      2,
        dashArray:   '6 5',
      }).addTo(mapState.map);

      mapState.selectedSensorId = 'center';
      mapState.map.flyTo([sA.lat, sA.lng], MAP_CONFIG.ZOOM_ALERT, {
        animate: true, duration: 1.5,
      });
      if (mA) mA.openPopup();
    } else if (etatAlerte === 'ALERTE') {
      if (mA) mA.setIcon(mkIcon('#f2a34a', true));

      mapState.isAcknowledged = false;
      addActivity(
        t('Anomaly detected ({type})', { type: typeLabel || (isJp ? '警告' : 'WARNING') }),
        isJp ? `流量：${debit} L/min · 監視中` : `Flow: ${debit} L/min · Monitoring active`,
        'warning'
      );

      mapState.circleA = L.circle([sA.lat, sA.lng], {
        radius:      MAP_CONFIG.ALERT_RADIUS,
        color:       '#f2a34a',
        fillColor:   '#f2a34a',
        fillOpacity: 0.10,
        weight:      2,
        dashArray:   '4 4',
      }).addTo(mapState.map);

      mapState.selectedSensorId = 'center';
      mapState.map.flyTo([sA.lat, sA.lng], MAP_CONFIG.ZOOM_ALERT, {
        animate: true, duration: 1.5,
      });
      if (mA) mA.openPopup();
    } else {
      if (mA) mA.setIcon(mkIcon('#087eba', false));

      mapState.isAcknowledged = false;
      addActivity(t('Network normalized'), t('Flow returned below the alert threshold'), 'success');

      if (mapState.selectedSensorId === 'center') {
        mapState.map.flyTo(MAP_CONFIG.CENTER, MAP_CONFIG.ZOOM, {
          animate: true, duration: 1.5,
        });
      }
    }
  }

  // Mise à jour du contenu textuel du popup Secteur A SANS jamais appeler openPopup()
  const mA = mapState.markers['center'];
  if (mA) {
    mA.setPopupContent(mkPopup(sA, etatAlerte, typeAlerte, debit, vanne));
  }

  // Mise à jour de la fiche latérale pour le capteur actuellement sélectionné
  renderSensorDetailCard(mapState.selectedSensorId, data);
}

// ── Fonctions carte ──────────────────────────────────────────
function centerLeak() {
  selectSensor('center', true);
}

function focusLeak() {
  const currentId = mapState.selectedSensorId || 'center';
  const sensor    = MAP_CONFIG.SENSORS.find(s => s.id === currentId) || MAP_CONFIG.SENSORS[0];
  mapState.map?.flyTo([sensor.lat, sensor.lng], MAP_CONFIG.ZOOM_ALERT, { duration: 1.2 });
  const marker = mapState.markers[sensor.id];
  if (marker) {
    marker.openPopup();
  }
  document.querySelector('.network-map')?.classList.add('map-focused');
  setTimeout(() => document.querySelector('.network-map')?.classList.remove('map-focused'), 900);
}

function acknowledgeLeak() {
  const t = (k, p) => window.KizunaI18n?.t(k, p) || k;
  mapState.isAcknowledged = true;
  set('mapStatus', t('PROCESSING'));
  const card = $('leakCard') || document.querySelector('.leak-card');
  card?.classList.add('acknowledged');
  addActivity(t('Leak acknowledged'), t('Intervention underway in Sector A'), '');
}

// ════════════════════════════════════════════════════════════
//  JOURNAL D'ACTIVITÉ & HISTORIQUE DES MESURES
// ════════════════════════════════════════════════════════════

/**
 * Ajoute une ligne en haut du journal d'activité (max 10 entrées).
 * @param {string} title - Titre de l'action
 * @param {string} detail - Description ou contexte
 * @param {string} type - '' (défaut/bleu) | 'success' (vert) | 'warning' (orange)
 */
function addActivity(title, detail, type = '') {
  const log = $('activityLog');
  if (!log) return;

  const li = document.createElement('li');
  const spanClass = type ? ` class="${type}"` : '';
  const isJp = window.KizunaI18n?.getLanguage() === 'jp';
  const time = new Date().toLocaleTimeString(isJp ? 'ja-JP' : 'en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });

  li.innerHTML = `<span${spanClass}>●</span><div><b>${title}</b><small><span>${detail}</span> · <time>${time}</time></small></div>`;
  log.prepend(li);

  while (log.children.length > 10) {
    log.removeChild(log.lastElementChild);
  }
}

/**
 * Rend les 15 lignes les plus récentes du tableau d'historique.
 * Applique une animation douce (fondu ~1.5 s) sur les nouvelles mesures.
 * @param {Array} mesures - Liste des mesures
 * @param {boolean} highlightNew - Active le highlight sur les nouvelles lignes
 */
function renderHistoryRows(mesures, highlightNew = true) {
  const tbody = $('historyBody');
  if (!tbody || !mesures) return;
  const t = (k, p) => window.KizunaI18n?.t(k, p) || k;

  if (mesures.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4">${t('Waiting for measurements…')}</td></tr>`;
    set('measureCount', t('0 measurements'));
    return;
  }

  // Ne conserve que les 15 lignes les plus récentes
  const newest15 = [...mesures].reverse().slice(0, 15);
  set('measureCount', t('{count} measurements', { count: newest15.length }));

  const currentBatchIds = new Set();
  const rows = newest15.map(m => {
    currentBatchIds.add(m.id);
    const timeStr    = m.timestamp.includes(' ') ? m.timestamp.split(' ')[1] : m.timestamp;
    const debit      = parseFloat(m.debit_eau).toFixed(1);
    const debitEvite = parseFloat(m.debit_evite || 0);
    const isAlert    = parseInt(m.alerte_fuite) === 1;

    let badgeClass = 'status-badge normal';
    let badgeText  = t('Normal');
    let analyse    = t('Normal consumption');

    const ouverturePct  = (m.ouverture_pct !== undefined && m.ouverture_pct !== null)
      ? parseInt(m.ouverture_pct, 10)
      : (debitEvite > 0 ? 0 : 100);

    if (ouverturePct === 0) {
      badgeClass = 'status-badge warning';
      badgeText  = t('Valve closed');
      analyse    = t('Valve closed – {avoided} L/min avoided', { avoided: debitEvite.toFixed(1) });
    } else if (ouverturePct < 100) {
      badgeClass = 'status-badge warning';
      badgeText  = t('Throttled {pct}%', { pct: ouverturePct });
      analyse    = t('Throttled {pct}% – {avoided} L/min saved', { pct: ouverturePct, avoided: debitEvite.toFixed(1) });
    } else if (isAlert) {
      badgeClass = 'status-badge anomaly';
      badgeText  = t('Anomaly');
      analyse    = t('Threshold exceeded');
    }

    const isNew = highlightNew && historyState.initialized && !historyState.renderedIds.has(m.id);
    const highlightClass = isNew ? ' row-new-highlight' : '';

    return `<tr class="${highlightClass}" data-id="${m.id}">
      <td>${timeStr}</td>
      <td><b>${debit}</b> L/min</td>
      <td><span class="${badgeClass}">${badgeText}</span></td>
      <td>${analyse}</td>
    </tr>`;
  }).join('');

  tbody.innerHTML = rows;

  historyState.renderedIds = currentBatchIds;
  historyState.initialized = true;
}

/**
 * Met à jour le tableau d'historique des mesures.
 * Si le tableau est en pause, bloque le rendu des lignes et incrémente le compteur.
 * @param {Array} mesures - Liste des mesures
 */
function updateHistoryTable(mesures) {
  if (!mesures) return;
  historyState.lastKnownMesures = mesures;

  if (historyState.isPaused) {
    const baseId = historyState.pausedSnapshotMaxId || 0;
    const newCount = mesures.filter(m => m.id > baseId).length;
    historyState.pausedNewReadingsCount = newCount;
    updatePausedLabel(newCount);
    return;
  }

  renderHistoryRows(mesures, true);
}

function updatePausedLabel(count) {
  const countSpan = $('historyPausedCount');
  const fullLabel = $('historyPausedCountLabel');
  const t = (k, p) => window.KizunaI18n?.t(k, p) || k;
  if (fullLabel) {
    fullLabel.textContent = t('Paused — {count} new readings', { count });
  } else if (countSpan) {
    countSpan.textContent = count;
  }
}

function toggleHistoryPause() {
  if (historyState.isPaused) {
    resumeHistory();
  } else {
    pauseHistory();
  }
}

function pauseHistory() {
  historyState.isPaused = true;
  const maxId = historyState.lastKnownMesures.length
    ? Math.max(...historyState.lastKnownMesures.map(m => m.id))
    : 0;
  historyState.pausedSnapshotMaxId = maxId;
  historyState.pausedNewReadingsCount = 0;

  const btn = $('historyToggleBtn');
  const label = $('historyToggleLabel');
  const dot = $('historyLiveDot');
  const notice = $('historyPausedNotice');
  const resumeBtn = $('historyResumeBtn');
  const t = (k, p) => window.KizunaI18n?.t(k, p) || k;

  if (btn) btn.classList.add('is-paused');
  if (dot) dot.style.display = 'none';
  if (label) label.textContent = t('Paused');
  if (notice) notice.style.display = 'inline-flex';
  if (resumeBtn) resumeBtn.textContent = t('Resume');
  updatePausedLabel(0);
}

function resumeHistory() {
  historyState.isPaused = false;
  historyState.pausedNewReadingsCount = 0;
  const btn = $('historyToggleBtn');
  const label = $('historyToggleLabel');
  const dot = $('historyLiveDot');
  const notice = $('historyPausedNotice');
  const fullLabel = $('historyPausedCountLabel');
  const t = (k, p) => window.KizunaI18n?.t(k, p) || k;

  if (btn) btn.classList.remove('is-paused');
  if (dot) dot.style.display = '';
  if (label) label.textContent = t('Live');
  if (notice) notice.style.display = 'none';
  if (fullLabel) fullLabel.textContent = t('Paused — 0 new readings');

  renderHistoryRows(historyState.lastKnownMesures, true);
}

// ════════════════════════════════════════════════════════════
//  AUTHENTIFICATION & PRÉFÉRENCES TECHNICIEN
// ════════════════════════════════════════════════════════════

/** Vérifie si un technicien est connecté et synchronise l'UI */
async function checkAuthSession() {
  try {
    const res = await fetch(CONFIG.API_AUTH, { cache: 'no-store' });
    const data = await res.json();

    if (data.success && data.authenticated && data.worker) {
      applyWorkerUI(data.worker);
    } else {
      // Non connecté : initialisation avec profil par défaut démo
      applyWorkerUI({
        id: 0,
        nom_complet: 'KIZUNA Technician (Guest)',
        email: 'technicien@kizuna.tn',
        telephone: '+21620123456',
        telegram_chat_id: '123456789',
        secteur_assigne: 'Sector A — ESPRIT Zone / El Ghazala',
        notify_sms: 1,
        notify_telegram: 1,
        isGuest: true,
      });
    }
  } catch (err) {
    console.warn('[Kizuna] Vérification session:', err);
  }
}

/** Met à jour tous les éléments d'affichage du technicien */
function applyWorkerUI(worker) {
  authState.worker = worker;
  const initials = getInitials(worker.nom_complet);

  // Sidebar
  set('sideUserName', worker.nom_complet || 'Technician');
  set('sideUserRole', worker.secteur_assigne || 'Network supervision');
  set('sideUserAvatar', initials);

  // Topbar
  set('topAvatar', initials);
  const greeting = $('topGreeting');
  if (greeting) {
    const prenom = (worker.nom_complet || 'Technician').split(' ')[0];
    const jp = window.KizunaI18n?.getLanguage() === 'jp';
    greeting.innerHTML = jp
      ? `こんにちは、${prenom}さん <span>✦</span>`
      : `Hello, ${prenom} <span>✦</span>`;
  }

  // Section Paramètres
  set('settingsAvatar', initials);
  set('settingsWorkerName', worker.nom_complet || 'Technician');
  set('settingsWorkerEmail', worker.email || '—');

  const prefNom = $('prefNom');
  if (prefNom) prefNom.value = worker.nom_complet || '';

  const prefSecteur = $('prefSecteur');
  if (prefSecteur) prefSecteur.value = worker.secteur_assigne || '';

  const prefSms = $('prefNotifySms');
  if (prefSms) prefSms.checked = parseInt(worker.notify_sms) === 1;

  const prefTel = $('prefTel');
  if (prefTel) prefTel.value = worker.telephone || '';

  const prefTg = $('prefNotifyTelegram');
  if (prefTg) prefTg.checked = parseInt(worker.notify_telegram) === 1;

  const prefTgChat = $('prefTelegram');
  if (prefTgChat) prefTgChat.value = worker.telegram_chat_id || '';

  // Badge statut
  const badge = $('authBadge');
  const t = (k, p) => window.KizunaI18n?.t(k, p) || k;
  if (badge) {
    if (worker.isGuest) {
      badge.innerHTML = `<i style="background:#f2a34a;"></i> ${t('GUEST')}`;
      badge.title = t('Click Switch Account to sign in');
    } else {
      badge.innerHTML = `<i style="background:#20a879;"></i> ${t('CONNECTED')}`;
      badge.title = t('Technician session active');
    }
  }

  const switchBtn = $('switchAccountBtn');
  if (switchBtn) {
    switchBtn.textContent = worker.isGuest ? t('Sign In') : t('Switch Account');
  }
}

/** Enregistre les préférences de coordonnées et canaux d'alerte */
async function savePreferences() {
  const btn = $('savePrefBtn');
  const nom_complet      = $('prefNom')?.value.trim();
  const secteur_assigne  = $('prefSecteur')?.value.trim();
  const notify_sms       = $('prefNotifySms')?.checked ? 1 : 0;
  const telephone        = $('prefTel')?.value.trim();
  const notify_telegram  = $('prefNotifyTelegram')?.checked ? 1 : 0;
  const telegram_chat_id = $('prefTelegram')?.value.trim();
  const t                = (k, p) => window.KizunaI18n?.t(k, p) || k;

  if (notify_sms && !telephone) {
    showSettingsFeedback(t('Please enter a phone number to enable SMS alerts.'), 'error');
    return;
  }
  if (notify_telegram && !telegram_chat_id) {
    showSettingsFeedback(t('Please enter your Telegram Chat ID to enable Telegram alerts.'), 'error');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = t('Saving…');
  }

  try {
    const res = await fetch(CONFIG.API_PREFS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nom_complet,
        secteur_assigne,
        notify_sms,
        telephone,
        notify_telegram,
        telegram_chat_id,
      }),
    });
    const data = await res.json();

    if (!data.success) {
      if (res.status === 401) {
        showSettingsFeedback('Authentication required: redirecting to sign-in…', 'warning');
        setTimeout(() => window.location.href = 'auth.html', 1500);
        return;
      }
      throw new Error(data.error || 'Could not save preferences');
    }

    applyWorkerUI(data.worker);
    showSettingsFeedback('✓ ' + data.message, 'success');
    addActivity(t('Preferences saved'), t('Channels: {channels}', { channels: `${notify_sms ? 'SMS ' : ''}${notify_telegram ? 'Telegram' : ''}`.trim() }), 'success');

  } catch (err) {
    showSettingsFeedback('Error: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '💾 ' + t('Save Preferences');
    }
  }
}

/** Déclenche une alerte de test immédiate (SMS sans URL + Telegram avec Maps) */
async function testNotificationAlert() {
  const btn = $('testNotifBtn');
  const t   = (k, p) => window.KizunaI18n?.t(k, p) || k;

  if (btn) {
    btn.disabled = true;
    btn.textContent = t('Sending…');
  }

  try {
    const res = await fetch(`${CONFIG.API_NOTIF}?action=test`, { method: 'POST' });
    const data = await res.json();

    if (!data.success) throw new Error(data.error || 'Test failed');

    const d = data.data || {};
    const smsCount = d.sms_envoyes || 0;
    const tgCount  = d.telegram_envoyes || 0;

    showSettingsFeedback(
      `✓ Test alert sent: ${smsCount} SMS (no link) and ${tgCount} Telegram (direct Maps link)!`,
      'success'
    );
    addActivity(t('Test alert triggered'), `${smsCount} SMS · ${tgCount} Telegram`, 'success');

  } catch (err) {
    showSettingsFeedback('Test error: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '⚡ ' + t('Test Alert');
    }
  }
}

/** Déconnexion de la session technicien */
async function handleLogout() {
  try {
    await fetch(CONFIG.API_LOGOUT);
    window.location.href = 'auth.html';
  } catch (err) {
    console.error('[Kizuna] Déconnexion:', err);
    window.location.href = 'auth.html';
  }
}

/** Affiche une notification temporaire dans la section Paramètres */
function showSettingsFeedback(message, type = 'info') {
  const fb = $('settingsFeedback');
  if (!fb) return;

  fb.style.display = 'block';
  fb.textContent   = message;

  if (type === 'success') {
    fb.style.background = '#e8f8f2';
    fb.style.border     = '1px solid #159b76';
    fb.style.color      = '#159b76';
  } else if (type === 'error') {
    fb.style.background = '#fef0f1';
    fb.style.border     = '1px solid #e34d5b';
    fb.style.color      = '#e34d5b';
  } else if (type === 'warning') {
    fb.style.background = '#fff8ee';
    fb.style.border     = '1px solid #f2a34a';
    fb.style.color      = '#c97722';
  } else {
    fb.style.background = '#eef7fa';
    fb.style.border     = '1px solid #168dbb';
    fb.style.color      = '#168dbb';
  }

  setTimeout(() => {
    fb.style.display = 'none';
  }, 7000);
}

// ════════════════════════════════════════════════════════════
//  CONTRÔLES (appels PHP réels)
// ════════════════════════════════════════════════════════════

/** Ouvre (true) ou ferme (false) la vanne via POST → controler_vanne.php */
async function setValve(open) {
  try {
    const form = new FormData();
    form.append('statut_vanne', open ? 'OUVERTE' : 'FERMEE');
    const r = await fetch(CONFIG.API_CONTROLE, { method: 'POST', body: form });
    const d = await r.json();
    if (!d.success) throw new Error(d.error);

    applyValveUI(open);   // feedback immédiat
    addActivity(
      open ? 'Valve opened' : 'Valve closed',
      open ? 'Manual command executed' : 'Flow interrupted by operator',
      open ? 'success' : 'warning'
    );
    appState.lastValveStatus = open ? 'OUVERTE' : 'FERMEE';
    fetchData();
  } catch (e) {
    console.error('[Kizuna] Vanne:', e);
  }
}

/** Active / désactive le mode nuit via POST → controler_vanne.php */
async function toggleNightMode() {
  const isNow = $('nightModeBtn')?.classList.contains('night-active');
  const nextMode = !isNow;
  try {
    const form = new FormData();
    form.append('mode_nuit', nextMode ? 1 : 0);
    const r = await fetch(CONFIG.API_CONTROLE, { method: 'POST', body: form });
    const d = await r.json();
    if (!d.success) throw new Error(d.error);

    addActivity(
      nextMode ? 'Night mode enabled' : 'Night mode disabled',
      nextMode ? 'Leak threshold lowered to 1.0 L/min' : 'Normal threshold restored (5.0 L/min)',
      nextMode ? 'warning' : 'success'
    );
    fetchData();
  } catch (e) {
    console.error('[Kizuna] Mode nuit:', e);
  }
}

/** Réinitialise la démo : ouvre la vanne (remplace resetSimulation). */
function resetSimulation() { setValve(true); }

// ════════════════════════════════════════════════════════════
//  CONTRÔLE DE DÉBIT & RÉGIMES PROPORTIONNELS
// ════════════════════════════════════════════════════════════

function updateSliderDisplay(val) {
  set('manualSliderVal', `${val}%`);
}

async function selectRegime(regime, dureeHeures = null) {
  try {
    const form = new FormData();
    form.append('regime', regime);
    if (regime === 'EVENEMENT' && dureeHeures) {
      form.append('duree_heures', dureeHeures);
    }
    const r = await fetch(CONFIG.API_DEBIT, { method: 'POST', body: form, credentials: 'include' });
    const d = await r.json();
    if (!d.success) {
      if (r.status === 401) {
        alert(window.KizunaI18n?.t('Authentication required. Please sign in.') || 'Authentication required. Please sign in.');
      } else {
        alert(d.error || 'Error changing regime');
      }
      return;
    }
    const t = (k, p) => window.KizunaI18n?.t(k, p) || k;
    addActivity(
      t('Regime changed: {regime}', { regime: t(regime) }),
      t('Operating regime updated'),
      'info'
    );
    fetchData();
  } catch (e) {
    console.error('[Kizuna] Regime error:', e);
  }
}

function applyEventDuration() {
  const input = $('eventHoursInput');
  const hours = input ? parseInt(input.value, 10) : 24;
  selectRegime('EVENEMENT', hours);
}

async function applyManualOpening(pct) {
  const slider = $('manualOpeningSlider');
  const val = pct !== undefined ? pct : (slider ? slider.value : 100);
  try {
    const form = new FormData();
    form.append('ouverture', val);
    const r = await fetch(CONFIG.API_DEBIT, { method: 'POST', body: form, credentials: 'include' });
    const d = await r.json();
    if (!d.success) {
      if (r.status === 401) {
        alert(window.KizunaI18n?.t('Authentication required. Please sign in.') || 'Authentication required. Please sign in.');
      } else {
        alert(d.error || 'Error setting manual opening');
      }
      return;
    }
    const t = (k, p) => window.KizunaI18n?.t(k, p) || k;
    addActivity(
      t('Manual opening set to {pct}%', { pct: val }),
      t('Manual valve opening applied'),
      'info'
    );
    fetchData();
  } catch (e) {
    console.error('[Kizuna] Manual opening error:', e);
  }
}

async function resetToAutoOpening() {
  try {
    const form = new FormData();
    form.append('ouverture', 'auto');
    const r = await fetch(CONFIG.API_DEBIT, { method: 'POST', body: form, credentials: 'include' });
    const d = await r.json();
    if (!d.success) {
      if (r.status === 401) {
        alert(window.KizunaI18n?.t('Authentication required. Please sign in.') || 'Authentication required. Please sign in.');
      } else {
        alert(d.error || 'Error resetting to auto');
      }
      return;
    }
    const t = (k, p) => window.KizunaI18n?.t(k, p) || k;
    addActivity(
      t('Valve opening reset to Auto'),
      t('Automatic regime control restored'),
      'success'
    );
    fetchData();
  } catch (e) {
    console.error('[Kizuna] Reset to auto error:', e);
  }
}

// ════════════════════════════════════════════════════════════
//  FETCH PRINCIPAL — toutes les 2 secondes
// ════════════════════════════════════════════════════════════

function updateLandingPreview(data) {
  const flowEl  = $('landingFlow');
  const savedEl = $('landingSaved');
  const alertEl = $('landingAlerts');
  if (!flowEl && !savedEl && !alertEl) return;

  if (!data || !data.success) {
    if (flowEl)  flowEl.textContent  = '—';
    if (savedEl) savedEl.textContent = '—';
    if (alertEl) alertEl.textContent = '—';
    return;
  }

  const derniere = data.mesures && data.mesures.length ? data.mesures[data.mesures.length - 1] : null;
  const flow = derniere ? parseFloat(derniere.debit_eau).toFixed(1) : '—';
  const saved = (data.stats && data.stats.eau_economisee !== undefined) ? Number(data.stats.eau_economisee).toFixed(1) : '0.0';
  const fermetures = (data.stats && data.stats.fermetures_aujourdhui !== undefined) ? data.stats.fermetures_aujourdhui : 0;

  if (flowEl)  flowEl.textContent  = flow;
  if (savedEl) savedEl.textContent = saved;
  if (alertEl) alertEl.textContent = String(fermetures);
}

async function fetchData() {
  try {
    const r = await fetch(CONFIG.API_LIRE, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    if (!d.success) throw new Error(d.error || 'Invalid response');

    applyStats(d);
    applyChart(d.mesures, d.seuil_actif);
    applyMap(d);
    updateHistoryTable(d.mesures);
    updateLandingPreview(d);
  } catch (e) {
    console.error('[Kizuna] Fetch:', e);
    updateLandingPreview(null);
  }
}

// ════════════════════════════════════════════════════════════
//  FONCTIONS GLOBALES (exposées pour les onclick HTML)
// ════════════════════════════════════════════════════════════
window.setValve             = setValve;
window.toggleNightMode      = toggleNightMode;
window.resetSimulation      = resetSimulation;
window.updateSliderDisplay  = updateSliderDisplay;
window.selectRegime         = selectRegime;
window.applyEventDuration   = applyEventDuration;
window.applyManualOpening   = applyManualOpening;
window.resetToAutoOpening   = resetToAutoOpening;
window.centerLeak           = centerLeak;
window.focusLeak            = focusLeak;
window.acknowledgeLeak      = acknowledgeLeak;
window.savePreferences      = savePreferences;
window.testNotificationAlert= testNotificationAlert;
window.handleLogout         = handleLogout;
window.toggleHistoryPause   = toggleHistoryPause;
window.resumeHistory        = resumeHistory;

// ════════════════════════════════════════════════════════════
//  DÉMARRAGE
// ════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  updateDate();
  const settingsPanel = document.getElementById('settings');
  if (settingsPanel && 'IntersectionObserver' in window) {
    const settingsObserver = new IntersectionObserver((entries, observer) => {
      if (entries.some(entry => entry.isIntersecting)) {
        settingsPanel.classList.add('is-visible');
        observer.disconnect();
      }
    }, { threshold: 0.12 });
    settingsObserver.observe(settingsPanel);
  } else if (settingsPanel) {
    settingsPanel.classList.add('is-visible');
  }
  injectMapCSS();
  initChart();
  initMap();

  const slider = $('manualOpeningSlider');
  if (slider) {
    slider.addEventListener('mousedown', () => { appState.isDraggingSlider = true; });
    slider.addEventListener('touchstart', () => { appState.isDraggingSlider = true; }, { passive: true });
    slider.addEventListener('mouseup', () => { appState.isDraggingSlider = false; });
    slider.addEventListener('touchend', () => { appState.isDraggingSlider = false; });
  }

  checkAuthSession();
  fetchData();
  appState.timer = setInterval(fetchData, CONFIG.REFRESH_MS);

  window.addEventListener('kizuna-language-change', () => {
    updateDate();
    if (authState.worker) applyWorkerUI(authState.worker);
    if (appState.chart) {
      appState.chart.data.datasets[0].label = window.KizunaI18n?.t('Delivered flow') || 'Delivered flow';
      appState.chart.data.datasets[1].label = window.KizunaI18n?.t('Demand') || 'Demand';
      appState.chart.data.datasets[2].label = window.KizunaI18n?.t('Alert threshold') || 'Alert threshold';
      appState.chart.update('none');
    }
    const t = (k, p) => window.KizunaI18n?.t(k, p) || k;
    const toggleLabel = $('historyToggleLabel');
    if (toggleLabel) {
      toggleLabel.textContent = historyState.isPaused ? t('Paused') : t('Live');
    }
    if (historyState.isPaused) {
      updatePausedLabel(historyState.pausedNewReadingsCount);
    }
    const resumeBtn = $('historyResumeBtn');
    if (resumeBtn) {
      resumeBtn.textContent = t('Resume');
    }
    if (appState.lastPrediction) {
      updatePredictionChip(
        appState.lastPrediction.active,
        appState.lastPrediction.pente,
        appState.lastPrediction.eta,
        appState.lastPrediction.etatAlerte
      );
    }
    fetchData();
  });
});
