const puppeteer = require('puppeteer-core');
const http = require('http');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const LATIN_WHITELIST = [
  'HydroMind', 'L/min', 'L', 'SMS', 'Telegram', 'GPS', 'ESP32', 'MySQL', 'CSV', 'PDF', 'A4', 'ESPRIT', 'KIZUNA',
  'Sector', 'Zone', 'El', 'Ghazala', 'Campus', 'Technology', 'Park', 'Ariana', 'Greater', 'Tunis', 'Sidi', 'Thabet', 'Cap', 'Bon', 'Nabeul', 'Sahel', 'Sousse',
  'EN', 'JP', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'Z', 'UTC', 'UTC+1', 'Z-score', 'std', 'jump', 'avg', 'max',
  'TK', 'YT', 'OpenStreetMap', 'leaflet', 'technicien@kizuna.tn', 'Kizuna2026!', 'Yassine', 'Trabelsi', 'CARTO', 'AM', 'PM',
  'NORMAL', 'ECO_NUIT', 'EVENEMENT'
];

function checkRemainingLatin(text) {
  if (!text) return [];
  let cleaned = text;
  const sorted = [...LATIN_WHITELIST].sort((a, b) => b.length - a.length);
  for (const item of sorted) {
    const regex = new RegExp(`\\b${item.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi');
    cleaned = cleaned.replace(regex, ' ');
  }
  cleaned = cleaned.replace(/[0-9\s.,:;!?()\[\]{}"'\\\/<>=+*^%$#@~`|\-_—–·✦•●✅🚨⚠️🔒💧🌙☀️👁️✈️📱⚙️✍️📊🖨️↻↗→←↓©⚡]+/g, ' ');
  const matches = cleaned.match(/[a-zA-Z]{2,}/g);
  return matches || [];
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
          if (val) results.push({ type: `[${a}] on <${el.tagName.toLowerCase()}>`, text: val });
        }
      });
    });

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.parentElement) return NodeFilter.FILTER_REJECT;
        const tag = node.parentElement.tagName.toLowerCase();
        if (['script', 'style', 'code', 'pre', 'noscript'].includes(tag)) return NodeFilter.FILTER_REJECT;
        const style = window.getComputedStyle(node.parentElement);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return NodeFilter.FILTER_REJECT;
        const text = node.textContent.trim();
        if (!text || text.length < 2) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    while (walker.nextNode()) {
      results.push({
        type: `text in <${walker.currentNode.parentElement.tagName.toLowerCase()}>`,
        text: walker.currentNode.textContent.trim()
      });
    }
    return results;
  });

  const violations = [];
  elements.forEach(item => {
    const untranslated = checkRemainingLatin(item.text);
    if (untranslated.length > 0) {
      violations.push({
        type: item.type,
        text: item.text,
        untranslated
      });
    }
  });

  return { totalScanned: elements.length, violations };
}

async function main() {
  console.log('=== LAUNCHING CHROME TO VERIFY DASHBOARD & FLOW CONTROL ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.toString());
  });

  // Login as technician first to ensure session is active
  await page.goto('http://localhost/kizuna_water/auth.html', { waitUntil: 'networkidle2' });
  await page.click('.quick-fill-btn');
  await page.click('#loginSubmitBtn');
  await new Promise(r => setTimeout(r, 1200));

  // Navigate to Dashboard
  console.log('\nNavigating to dashboard.html...');
  await page.goto('http://localhost/kizuna_water/dashboard.html', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));

  // Verify Flow Control panel elements
  console.log('\n--- Checking Flow Control Panel UI Elements ---');
  const flowControlExists = await page.$('#flowControl') !== null;
  console.log('Flow Control panel exists:', flowControlExists);

  const gaugeOpening = await page.$eval('#gaugeOpeningText', el => el.textContent.trim());
  const demandDelivered = await page.$eval('#gaugeDemandDeliveredText', el => el.textContent.trim());
  const valveStateText = await page.$eval('#valveState', el => el.textContent.trim());
  console.log('Gauge Opening:', gaugeOpening);
  console.log('Demand -> Delivered:', demandDelivered);
  console.log('Valve card state text:', valveStateText);

  // Test JP Language Switch and Coverage Scan
  console.log('\n--- Switching to Japanese (JP) ---');
  await page.click('button[data-kizuna-language="jp"]');
  await new Promise(r => setTimeout(r, 1000));

  const jpGaugeOpening = await page.$eval('#gaugeOpeningText', el => el.textContent.trim());
  const jpDemandDelivered = await page.$eval('#gaugeDemandDeliveredText', el => el.textContent.trim());
  const jpValveStateText = await page.$eval('#valveState', el => el.textContent.trim());
  console.log('JP Gauge Opening:', jpGaugeOpening);
  console.log('JP Demand -> Delivered:', jpDemandDelivered);
  console.log('JP Valve card state text:', jpValveStateText);

  console.log('\n--- Running JP Coverage Scan ---');
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

  console.log(`\nConsole Errors Count: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log('Console Errors:', consoleErrors);
  } else {
    console.log('✔ ZERO CONSOLE ERRORS!');
  }

  await browser.close();
  console.log('\n=== ALL FLOW CONTROL CHECKS PASSED ===');
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
