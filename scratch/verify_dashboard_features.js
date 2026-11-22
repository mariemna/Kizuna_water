// scratch/verify_dashboard_features.js
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const http = require('http');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\asus\\.gemini\\antigravity\\brain\\c1d3e4aa-1653-467d-a0f9-1ad7eccaaf75';
const WORKSPACE_SCREENSHOTS = 'C:\\xampp\\htdocs\\kizuna_water\\screenshots';

const LATIN_WHITELIST = [
  'HydroMind', 'L/min', 'L', 'SMS', 'Telegram', 'GPS', 'ESP32', 'MySQL', 'CSV', 'PDF', 'A4', 'ESPRIT', 'KIZUNA',
  'Sector', 'Zone', 'El', 'Ghazala', 'Campus', 'Technology', 'Park', 'Ariana', 'Greater', 'Tunis', 'Sidi', 'Thabet', 'Cap', 'Bon', 'Nabeul', 'Sahel', 'Sousse',
  'EN', 'JP', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'Z', 'UTC', 'UTC+1', 'Z-score', 'std', 'jump', 'avg', 'max',
  'TK', 'YT', 'OpenStreetMap', 'leaflet', 'technicien@kizuna.tn', 'Kizuna2026!', 'Yassine', 'Trabelsi', 'CARTO', 'AM', 'PM'
];

function checkRemainingLatin(text) {
  if (!text) return [];
  let cleaned = text;
  const sorted = [...LATIN_WHITELIST].sort((a, b) => b.length - a.length);
  for (const item of sorted) {
    const regex = new RegExp(`\\b${item.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi');
    cleaned = cleaned.replace(regex, ' ');
  }
  cleaned = cleaned.replace(/[0-9\s.,:;!?()\[\]{}"'\\\/<>=+*^%$#@~`|\-_—–·✦•●✅🚨⚠️🔒💧🌙☀️👁️✈️📱⚙️✍️📊🖨️↻↗→←↓©]+/g, ' ');
  const matches = cleaned.match(/[a-zA-Z]{2,}/g);
  return matches || [];
}

function sendHttpRequest(pathName, postData = '') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 80,
      path: pathName,
      method: postData ? 'POST' : 'GET',
      headers: postData ? {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      } : {}
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function postReading(flow) {
  return sendHttpRequest('/kizuna_water/recevoir_donnees.php', `debit_eau=${flow}`);
}

async function resetSystem() {
  return sendHttpRequest('/kizuna_water/controler_vanne.php', 'statut_vanne=OUVERTE&mode_nuit=0');
}

async function scanPageForLatin(page, label) {
  const elements = await page.evaluate(() => {
    const results = [];
    results.push({ type: '<title>', text: document.title });

    const attrs = ['title', 'placeholder', 'aria-label', 'alt'];
    const selector = attrs.map(a => `[${a}]`).join(',');
    document.querySelectorAll(selector).forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      attrs.forEach(a => {
        if (el.hasAttribute(a)) {
          const val = el.getAttribute(a).trim();
          if (val) results.push({ type: `attr[${a}]`, tag: el.tagName, text: val });
        }
      });
    });

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.parentElement) return NodeFilter.FILTER_REJECT;
        if (n.parentElement.closest('script, style, code, pre')) return NodeFilter.FILTER_REJECT;
        if (n.parentElement.closest('[style*="display: none"], [style*="display:none"], [hidden]')) return NodeFilter.FILTER_REJECT;
        const style = window.getComputedStyle(n.parentElement);
        if (style.display === 'none' || style.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
        const txt = n.textContent.trim();
        return txt.length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });

    while (walker.nextNode()) {
      results.push({ type: 'text', tag: walker.currentNode.parentElement.tagName, text: walker.currentNode.textContent.trim() });
    }

    return results;
  });

  const violations = [];
  elements.forEach(item => {
    const remaining = checkRemainingLatin(item.text);
    if (remaining.length > 0) {
      violations.push({
        type: item.type,
        tag: item.tag || '',
        text: item.text,
        latinWords: remaining
      });
    }
  });

  return { label, totalScanned: elements.length, violations };
}

async function captureScreen(page, filename) {
  const p1 = path.join(ARTIFACT_DIR, filename);
  const p2 = path.join(WORKSPACE_SCREENSHOTS, filename);
  await page.screenshot({ path: p1, fullPage: false });
  try {
    fs.copyFileSync(p1, p2);
  } catch (e) {}
  console.log(`[Screenshot Saved] ${filename}`);
}

async function main() {
  console.log('=== STARTING DASHBOARD VERIFICATION & SCREENSHOT PIPELINE ===');
  if (!fs.existsSync(WORKSPACE_SCREENSHOTS)) {
    fs.mkdirSync(WORKSPACE_SCREENSHOTS, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[Console Error] ${msg.text()}`);
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(`[Page Error] ${err.toString()}`);
  });

  // 1. Reset system to nominal and send a live reading
  console.log('Resetting system and posting live reading...');
  await resetSystem();
  await postReading(2.15);
  await new Promise(r => setTimeout(r, 600));

  // 2. Open dashboard in English
  console.log('Opening dashboard.html (EN)...');
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('kizuna_language', 'en');
  });
  await page.goto('http://localhost/kizuna_water/dashboard.html', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2200));

  // Check initial state
  const initialBadge = await page.$eval('#sensorStatusBadge', el => ({ text: el.textContent, class: el.className }));
  console.log('Sensor Badge (Live):', initialBadge);

  const flowCardFoot = await page.$eval('#flowFoot', el => el.textContent);
  console.log('Flow Foot (Live):', flowCardFoot);

  // Keep newest 15 rows visible check
  const rowCount = await page.$$eval('#historyBody tr', rows => rows.length);
  console.log(`History table rows visible: ${rowCount} (Expected: <= 15)`);

  // ── SCREENSHOTS: LIVE (Light & Dark) ────────────────────────
  console.log('\n--- Capturing Dashboard LIVE ---');
  await postReading(2.20);
  await new Promise(r => setTimeout(r, 1200));

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await captureScreen(page, 'dashboard_live_light.png');

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await captureScreen(page, 'dashboard_live_dark.png');

  // ── TEST PAUSE & CAPTURE: PAUSED (Light & Dark) ─────────────
  console.log('\n--- Testing History Pause ---');
  // Click toggle button to pause
  await page.click('#historyToggleBtn');
  await new Promise(r => setTimeout(r, 300));

  const isPausedBtn = await page.$eval('#historyToggleBtn', el => ({ text: el.textContent.trim(), isPaused: el.classList.contains('is-paused') }));
  console.log('Toggle Button after click:', isPausedBtn);

  const initialRowsText = await page.$$eval('#historyBody tr td:first-child', cells => cells.map(c => c.textContent));

  // Send 3 new readings while paused
  console.log('Sending 3 readings while paused...');
  await postReading(2.35);
  await new Promise(r => setTimeout(r, 600));
  await postReading(2.40);
  await new Promise(r => setTimeout(r, 600));
  await postReading(2.45);
  await new Promise(r => setTimeout(r, 2200));

  // Verify table did not update rows
  const pausedRowsText = await page.$$eval('#historyBody tr td:first-child', cells => cells.map(c => c.textContent));
  const tableRemainedFrozen = JSON.stringify(initialRowsText) === JSON.stringify(pausedRowsText);
  console.log('Table remained frozen while paused:', tableRemainedFrozen ? 'PASS' : 'FAIL');

  const pausedNoticeText = await page.$eval('#historyPausedNotice', el => el.textContent.trim());
  console.log('Paused notice text:', pausedNoticeText);

  // Capture Paused Light & Dark
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await captureScreen(page, 'dashboard_paused_light.png');

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await captureScreen(page, 'dashboard_paused_dark.png');

  // Test Resume
  console.log('Clicking Resume...');
  await page.click('#historyResumeBtn');
  await new Promise(r => setTimeout(r, 100));

  const resumedRows = await page.$$eval('#historyBody tr', rows => ({
    count: rows.length,
    highlightCount: rows.filter(r => r.classList.contains('row-new-highlight')).length,
    hasHighlight: rows.some(r => r.classList.contains('row-new-highlight'))
  }));
  console.log(`Resumed: ${resumedRows.count} rows, new row highlight active: ${resumedRows.hasHighlight} (${resumedRows.highlightCount} highlighted)`);

  // ── TEST OFFLINE (stop sending readings for 15 s) ────────────
  console.log('\n--- Testing Sensor Offline (waiting 15s without sending readings) ---');
  // Wait 15 seconds so seconds_since_last_reading > 10 s
  console.log('Waiting 15 seconds for sensor to go offline...');
  await new Promise(r => setTimeout(r, 15000));

  // Wait for next fetchData cycle
  await new Promise(r => setTimeout(r, 2500));

  const offlineBadge = await page.$eval('#sensorStatusBadge', el => ({ text: el.textContent, class: el.className }));
  console.log('Sensor Badge (Offline):', offlineBadge);

  const offlineFlowFoot = await page.$eval('#flowFoot', el => el.textContent);
  console.log('Flow Foot (Offline):', offlineFlowFoot);

  const lastKnownTag = await page.$eval('#flowLastKnownTag', el => ({ text: el.textContent, display: window.getComputedStyle(el).display }));
  console.log('Flow Last Known Tag:', lastKnownTag);

  const bannerOfflineState = await page.$eval('#alertBanner', el => ({
    title: el.querySelector('#bannerTitle')?.textContent,
    text: el.querySelector('#bannerText')?.textContent,
    time: el.querySelector('#bannerTime')?.textContent,
    class: el.className
  }));
  console.log('Banner Offline State:', bannerOfflineState);

  // Capture Offline Light & Dark
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await captureScreen(page, 'dashboard_offline_light.png');

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await captureScreen(page, 'dashboard_offline_dark.png');

  // ── TEST RECOVERY: Send new reading and check back to green Online badge ──
  console.log('\n--- Testing Sensor Online Recovery ---');
  await postReading(2.05);
  await new Promise(r => setTimeout(r, 2500));

  const recoveredBadge = await page.$eval('#sensorStatusBadge', el => ({ text: el.textContent, class: el.className }));
  console.log('Sensor Badge after new reading:', recoveredBadge);

  // ── TEST EN / JP SWITCHING & JP COVERAGE SCAN ────────────────
  console.log('\n--- Testing EN / JP Language Switching ---');
  await page.click('button[data-kizuna-language="jp"]');
  await new Promise(r => setTimeout(r, 800));

  const jpBadge = await page.$eval('#sensorStatusBadge', el => el.textContent);
  const jpToggle = await page.$eval('#historyToggleBtn', el => el.textContent.trim());
  console.log(`JP Badge: "${jpBadge}", JP Toggle: "${jpToggle}"`);

  console.log('\n--- Running JP Coverage Scan on Dashboard ---');
  const scanResult = await scanPageForLatin(page, 'dashboard.html [JP]');
  console.log(`Total elements scanned: ${scanResult.totalScanned}`);
  console.log(`Violations count: ${scanResult.violations.length}`);
  if (scanResult.violations.length > 0) {
    console.log('Violations found:', JSON.stringify(scanResult.violations, null, 2));
  } else {
    console.log('✔ ZERO JP COVERAGE VIOLATIONS on dashboard.html!');
  }

  // Switch back to EN
  await page.click('button[data-kizuna-language="en"]');
  await new Promise(r => setTimeout(r, 800));
  const enBadge = await page.$eval('#sensorStatusBadge', el => el.textContent);
  console.log(`Switched back to EN, Badge: "${enBadge}"`);

  console.log(`\nConsole Errors Count: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log('Console Errors:', consoleErrors);
  }

  await browser.close();
  console.log('=== VERIFICATION COMPLETE ===');
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
