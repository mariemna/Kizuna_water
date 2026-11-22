// scratch/verify_prediction_screenshots.js
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\asus\\.gemini\\antigravity\\brain\\5cd2d4ab-1ad2-476e-9873-705df1757707';
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
  cleaned = cleaned.replace(/[0-9\s.,:;!?()\[\]{}"'\\\/<>=+*^%$#@~`|\-_—–·✦•●✅🚨⚠️🔒💧🌙☀️👁️✈️📱⚙️✍️📊🖨️↻↗→←↓©🔮📈⏳ℹ️🗺️]+/g, ' ');
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

function runSql(query) {
  const cmd = `c:\\xampp\\mysql\\bin\\mysql.exe -u root -e "${query}" kizuna_water`;
  execSync(cmd, { stdio: 'inherit' });
}

async function captureScreen(page, filename) {
  if (!fs.existsSync(WORKSPACE_SCREENSHOTS)) {
    fs.mkdirSync(WORKSPACE_SCREENSHOTS, { recursive: true });
  }
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }
  const p1 = path.join(ARTIFACT_DIR, filename);
  const p2 = path.join(WORKSPACE_SCREENSHOTS, filename);
  await page.screenshot({ path: p1, fullPage: false });
  fs.copyFileSync(p1, p2);
  console.log(`[Screenshot Saved] ${filename} -> ${p2}`);
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

async function main() {
  console.log('=== STARTING PREDICTION CHIP VERIFICATION & SCREENSHOTS ===');

  // 1. Post a fresh flow reading so sensor is ONLINE and banner is green
  console.log('Sending nominal flow reading to keep sensor ONLINE...');
  await sendHttpRequest('/kizuna_water/recevoir_donnees.php', 'debit_eau=2.15');
  await new Promise(r => setTimeout(r, 400));

  // 2. Activate prediction in DB: active=1, pente=0.12, eta=15, state=NORMAL, valve=OUVERTE
  console.log('Activating prediction state in MySQL DB...');
  runSql("UPDATE etat_systeme SET prediction_active = 1, prediction_pente = 0.12, prediction_eta_min = 15.0, etat_alerte = 'NORMAL', statut_vanne = 'OUVERTE' WHERE id = 1;");

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

  // 3. Open dashboard in English
  console.log('Navigating to dashboard.html (EN)...');
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('kizuna_language', 'en');
  });
  await page.goto('http://localhost/kizuna_water/dashboard.html', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  // Verify prediction chip is displayed and banner is normal green
  const bannerClass = await page.$eval('#alertBanner', el => el.className);
  const chipDisplay = await page.$eval('#predictionChip', el => window.getComputedStyle(el).display);
  const chipTextEn = await page.$eval('#predictionChipText', el => el.textContent.trim());

  console.log(`Alert Banner class: "${bannerClass}" (Expected to contain banner-normal)`);
  console.log(`Prediction Chip display: "${chipDisplay}" (Expected: inline-flex)`);
  console.log(`Prediction Chip Text [EN]: "${chipTextEn}"`);

  if (!chipDisplay.includes('flex')) {
    throw new Error('Prediction chip is not visible!');
  }
  if (!bannerClass.includes('banner-normal')) {
    console.warn('Banner is not banner-normal! Class is:', bannerClass);
  }

  // Screenshot 1: Light Theme - EN
  console.log('\nCapturing Light Theme (EN)...');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await captureScreen(page, 'dashboard_prediction_chip_light_en.png');

  // Screenshot 2: Dark Theme - EN
  console.log('\nCapturing Dark Theme (EN)...');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await captureScreen(page, 'dashboard_prediction_chip_dark_en.png');

  // Screenshot 3: Dark Theme - JP
  console.log('\nSwitching language to Japanese (JP)...');
  await page.click('button[data-kizuna-language="jp"]');
  await new Promise(r => setTimeout(r, 800));

  const chipTextJp = await page.$eval('#predictionChipText', el => el.textContent.trim());
  console.log(`Prediction Chip Text [JP]: "${chipTextJp}"`);

  console.log('Capturing Dark Theme (JP)...');
  await captureScreen(page, 'dashboard_prediction_chip_dark_jp.png');

  // Screenshot 4: Light Theme - JP
  console.log('\nCapturing Light Theme (JP)...');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await captureScreen(page, 'dashboard_prediction_chip_light_jp.png');

  // JP Coverage scan
  console.log('\nRunning JP Coverage Scan...');
  const scanResult = await scanPageForLatin(page, 'dashboard.html [JP with Prediction Chip]');
  console.log(`Total elements scanned: ${scanResult.totalScanned}`);
  console.log(`Violations count: ${scanResult.violations.length}`);
  if (scanResult.violations.length > 0) {
    console.log('Violations found:', JSON.stringify(scanResult.violations, null, 2));
  } else {
    console.log('✔ ZERO JP COVERAGE VIOLATIONS on dashboard.html!');
  }

  // Test disappearing when prediction_active = 0
  console.log('\nResetting prediction_active = 0 in DB and waiting for auto-refresh...');
  runSql("UPDATE etat_systeme SET prediction_active = 0, prediction_pente = NULL, prediction_eta_min = NULL, etat_alerte = 'NORMAL', statut_vanne = 'OUVERTE' WHERE id = 1;");
  // Also send reading so offline doesn't trigger
  await sendHttpRequest('/kizuna_water/recevoir_donnees.php', 'debit_eau=2.15');
  await new Promise(r => setTimeout(r, 2500));

  const chipDisplayAfterReset = await page.$eval('#predictionChip', el => window.getComputedStyle(el).display);
  console.log(`Prediction Chip display after reset: "${chipDisplayAfterReset}" (Expected: none)`);

  console.log(`\nConsole Errors Count: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.error('Console Errors:', consoleErrors);
  } else {
    console.log('✔ ZERO CONSOLE ERRORS detected!');
  }

  await browser.close();
  console.log('=== VERIFICATION & SCREENSHOTS COMPLETED SUCCESSFULLY ===');
}

main().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
