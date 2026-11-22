// scratch/verify_pages.js
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const http = require('http');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\asus\\.gemini\\antigravity\\brain\\1d75c8be-85c9-42d2-8a08-5625f9a3b877';

// Strict whitelist per user guidelines:
// Keep in Latin script: HydroMind, L/min, L, SMS, Telegram, GPS, ESP32, MySQL, CSV, PDF, A4, ESPRIT, KIZUNA.
// Plus project-specific sector names/addresses per PART A & technical codes (R1-R5, EN/JP, proper names)
const LATIN_WHITELIST = [
  'HydroMind', 'L/min', 'L', 'SMS', 'Telegram', 'GPS', 'ESP32', 'MySQL', 'CSV', 'PDF', 'A4', 'ESPRIT', 'KIZUNA',
  // Required English sector name and address per PART A
  'Sector', 'Zone', 'El', 'Ghazala', 'Campus', 'Technology', 'Park', 'Ariana', 'Greater', 'Tunis', 'Sidi', 'Thabet', 'Cap', 'Bon', 'Nabeul', 'Sahel', 'Sousse',
  // Technical identifiers, map libraries & proper names
  'EN', 'JP', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'Z', 'UTC', 'UTC+1', 'Z-score', 'std', 'jump', 'avg', 'max',
  'TK', 'YT', 'OpenStreetMap', 'leaflet', 'technicien@kizuna.tn', 'Kizuna2026!', 'Yassine', 'Trabelsi', 'CARTO'
];

function triggerState(action, type, debit) {
  return new Promise((resolve, reject) => {
    let postData = '';
    let endpoint = '';
    if (action === 'RESET_NORMAL') {
      postData = 'statut_vanne=OUVERTE&mode_nuit=0';
      endpoint = '/kizuna_water/controler_vanne.php';
    } else if (action === 'ALERTE') {
      postData = `action=ALERTE&type=${type || 'PIC'}&debit=${debit || '8.5'}`;
      endpoint = '/kizuna_water/signaler_anomalie.php';
    } else if (action === 'FERMEE') {
      postData = `action=FERMETURE&type=${type || 'RUPTURE'}&debit=${debit || '9.8'}`;
      endpoint = '/kizuna_water/signaler_anomalie.php';
    }

    const options = {
      hostname: 'localhost',
      port: 80,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function checkRemainingLatin(text) {
  if (!text) return [];
  let cleaned = text;
  // Sort whitelist by length descending
  const sorted = [...LATIN_WHITELIST].sort((a, b) => b.length - a.length);
  for (const item of sorted) {
    const regex = new RegExp(`\\b${item.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi');
    cleaned = cleaned.replace(regex, ' ');
  }
  // Strip numbers, punctuation, japanese characters, emojis
  cleaned = cleaned.replace(/[0-9\s.,:;!?()\[\]{}"'\\\/<>=+*^%$#@~`|\-_—–·✦•●✅🚨⚠️🔒💧🌙☀️👁️✈️📱⚙️✍️📊🖨️↻↗→←↓©]+/g, ' ');
  // Look for any remaining latin words [a-zA-Z]{2,}
  const matches = cleaned.match(/[a-zA-Z]{2,}/g);
  return matches || [];
}

async function scanPage(page, pageName) {
  const elements = await page.evaluate(() => {
    const results = [];
    // 1. Document title
    results.push({ type: '<title>', text: document.title });

    // 2. Attributes
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

    // 3. Text nodes
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.parentElement) return NodeFilter.FILTER_REJECT;
        if (n.parentElement.closest('script, style, code, pre')) return NodeFilter.FILTER_REJECT;
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

  return { pageName, totalScanned: elements.length, violations };
}

async function testSwitching(page, url, pageLabel) {
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.setItem('kizuna_language', 'jp'));
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 300));
  const jp = await page.evaluate(() => document.documentElement.lang);

  // Switch to EN via button
  await page.click('button[data-kizuna-language="en"]');
  await new Promise(r => setTimeout(r, 600));
  const en = await page.evaluate(() => document.documentElement.lang);

  // Switch back to JP
  await page.click('button[data-kizuna-language="jp"]');
  await new Promise(r => setTimeout(r, 600));
  const jp2 = await page.evaluate(() => document.documentElement.lang);

  const ok = (jp === 'ja' && en === 'en' && jp2 === 'ja');
  console.log(`[Switch Test] ${pageLabel}: ${ok ? 'PASS' : 'FAIL'} (JP:${jp} -> EN:${en} -> JP:${jp2})`);
  return ok;
}

async function main() {
  console.log('Starting full verification and screenshot pipeline...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1366,850']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 850 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(`[Console Error] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    consoleErrors.push(`[Page Error] ${err.toString()}`);
  });

  // Test EN/JP switching on every page first
  console.log('\n--- TESTING EN <-> JP SWITCHING ON EVERY PAGE ---');
  await testSwitching(page, 'http://localhost/kizuna_water/index.html', 'index.html');
  await testSwitching(page, 'http://localhost/kizuna_water/auth.html', 'auth.html');
  await testSwitching(page, 'http://localhost/kizuna_water/dashboard.html', 'dashboard.html');

  // Sign in technician for rapport.php
  await page.goto('http://localhost/kizuna_water/auth.html', { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    document.getElementById('loginEmail').value = 'technicien@kizuna.tn';
    document.getElementById('loginPassword').value = 'Kizuna2026!';
    document.getElementById('loginForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await new Promise(r => setTimeout(r, 1000));
  const todayStr = new Date().toISOString().split('T')[0];
  await testSwitching(page, `http://localhost/kizuna_water/rapport.php?du=${todayStr}&au=${todayStr}`, 'rapport.php');

  // Now set JP mode in localStorage and perform coverage scan + screenshots
  console.log('\n--- RUNNING COVERAGE SCANS & CAPTURING SCREENSHOTS (JP MODE) ---');
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('kizuna_language', 'jp');
  });

  const results = [];

  // 1. index.html
  console.log('Scanning index.html...');
  await page.goto('http://localhost/kizuna_water/index.html', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));
  results.push(await scanPage(page, 'index.html'));

  // 2. auth.html
  console.log('Scanning auth.html...');
  await page.goto('http://localhost/kizuna_water/auth.html', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));
  results.push(await scanPage(page, 'auth.html'));

  // 3. dashboard.html - NORMAL state
  console.log('Normalizing state to NORMAL...');
  await triggerState('RESET_NORMAL');
  await new Promise(r => setTimeout(r, 600));

  console.log('Scanning dashboard.html [NORMAL]...');
  await page.goto('http://localhost/kizuna_water/dashboard.html', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2200));
  results.push(await scanPage(page, 'dashboard.html [NORMAL]'));

  // 4. dashboard.html - ALERTE state
  console.log('Triggering ALERTE state...');
  await triggerState('ALERTE', 'PIC', 8.5);
  await new Promise(r => setTimeout(r, 2200));
  results.push(await scanPage(page, 'dashboard.html [ALERTE]'));

  // Capture Screenshot: ALERTE Light
  console.log('Capturing dashboard ALERTE Light...');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'dashboard_alerte_light_jp.png'), fullPage: false });

  // Capture Screenshot: ALERTE Dark
  console.log('Capturing dashboard ALERTE Dark...');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'dashboard_alerte_dark_jp.png'), fullPage: false });

  // 5. dashboard.html - FERMEE state
  console.log('Triggering FERMEE state...');
  await triggerState('FERMEE', 'RUPTURE', 9.8);
  await new Promise(r => setTimeout(r, 2200));
  results.push(await scanPage(page, 'dashboard.html [FERMEE]'));

  // Capture Screenshot: FERMEE Light
  console.log('Capturing dashboard FERMEE Light...');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'dashboard_fermee_light_jp.png'), fullPage: false });

  // Capture Screenshot: FERMEE Dark
  console.log('Capturing dashboard FERMEE Dark...');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'dashboard_fermee_dark_jp.png'), fullPage: false });

  // 6. Export Modal
  console.log('Opening export modal...');
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    if (typeof openExportModal === 'function') openExportModal();
    else {
      const btn = document.querySelector('[data-action="export"]') || document.getElementById('openExportBtn');
      if (btn) btn.click();
    }
  });
  await new Promise(r => setTimeout(r, 800));
  results.push(await scanPage(page, 'Export Modal'));

  // Capture Screenshot: Export Modal
  console.log('Capturing Export Modal...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'export_modal_jp.png') });

  // Close modal
  await page.evaluate(() => {
    if (typeof closeExportModal === 'function') closeExportModal();
  });

  // 7. rapport.php (today)
  console.log('Scanning rapport.php...');
  await page.goto(`http://localhost/kizuna_water/rapport.php?du=${todayStr}&au=${todayStr}`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));
  results.push(await scanPage(page, 'rapport.php (today)'));

  // Capture Screenshot: rapport.php print preview (screen emulated print media)
  console.log('Capturing rapport.php print preview...');
  await page.emulateMediaType('print');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'rapport_print_preview_jp.png'), fullPage: true });

  await browser.close();

  // Reset to normal
  await triggerState('RESET_NORMAL');

  console.log('\n========================================');
  console.log('       COVERAGE SCAN RESULTS (JP MODE)   ');
  console.log('========================================');
  let totalViolations = 0;
  results.forEach(r => {
    console.log(`\nPage: ${r.pageName} (Scanned nodes/attributes: ${r.totalScanned})`);
    if (r.violations.length === 0) {
      console.log('  ✔ 0 remaining Latin strings!');
    } else {
      console.log(`  ❌ ${r.violations.length} remaining:`);
      r.violations.forEach(v => {
        console.log(`    - [${v.type}] "${v.text}" => Unmatched: ${JSON.stringify(v.latinWords)}`);
      });
      totalViolations += r.violations.length;
    }
  });

  console.log('\n========================================');
  console.log(`Console Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    consoleErrors.forEach(e => console.log('  ' + e));
  } else {
    console.log('  ✔ 0 console errors across all pages!');
  }
  console.log(`Total Unmatched Latin Strings: ${totalViolations}`);
  console.log('========================================\n');
}

main().catch(err => {
  console.error('Execution error:', err);
  process.exit(1);
});
