const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.resolve('screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── HTTP Helper ───────────────────────────────────────────────
function postJson(url, postData, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const bodyStr = JSON.stringify(postData);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 80,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...headers
      }
    };

    const req = http.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data
        });
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function getUrl(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 80,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers
    };

    const req = http.request(options, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          buffer,
          data: buffer.toString('utf8')
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── Chrome CDP Client ─────────────────────────────────────────
class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
    this.consoleErrors = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = reject;
      this.ws.onmessage = msg => {
        const res = JSON.parse(msg.data);
        if (res.method === 'Runtime.consoleAPICalled') {
          if (res.params.type === 'error') {
            const text = res.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
            this.consoleErrors.push(text);
          }
        } else if (res.method === 'Runtime.exceptionThrown') {
          this.consoleErrors.push(res.params.exceptionDetails.text + ': ' + (res.params.exceptionDetails.exception?.description || ''));
        }

        if (res.id && this.callbacks.has(res.id)) {
          const cb = this.callbacks.get(res.id);
          this.callbacks.delete(res.id);
          if (res.error) cb.reject(new Error(res.error.message));
          else cb.resolve(res.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const callId = this.id++;
      this.callbacks.set(callId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: callId, method, params }));
    });
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await delay(1500);
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return res.result?.value;
  }

  async screenshot(filePath, fullPage = false) {
    let params = { format: 'png' };
    if (fullPage) {
      const metrics = await this.send('Page.getLayoutMetrics');
      const width = Math.ceil(metrics.contentSize.width);
      const height = Math.ceil(metrics.contentSize.height);
      await this.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false
      });
      params.captureBeyondViewport = true;
    }
    const res = await this.send('Page.captureScreenshot', params);
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot: ${path.basename(filePath)} (${(fs.statSync(filePath).size / 1024).toFixed(1)} KB)`);
  }

  async printPdf(filePath) {
    const res = await this.send('Page.printToPDF', {
      printBackground: true,
      paperWidth: 8.27, // A4 in inches
      paperHeight: 11.69,
      marginTop: 0.4,
      marginBottom: 0.4,
      marginLeft: 0.4,
      marginRight: 0.4
    });
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    console.log(`Saved PDF: ${path.basename(filePath)} (${(fs.statSync(filePath).size / 1024).toFixed(1)} KB)`);
  }
}

async function main() {
  console.log('====================================================');
  console.log('▶ STEP 1: Logging in to get worker session...');
  console.log('====================================================');

  const loginRes = await postJson('http://localhost/kizuna_water/login.php', {
    email: 'technicien@kizuna.tn',
    password: 'Kizuna2026!'
  });

  console.log('Login Status:', loginRes.statusCode);
  console.log('Login Body:', loginRes.data);

  const rawCookie = loginRes.headers['set-cookie'];
  if (!rawCookie || !rawCookie.length) {
    throw new Error('No Set-Cookie returned from login.php!');
  }

  const match = rawCookie[0].match(/PHPSESSID=([^;]+)/);
  if (!match) {
    throw new Error('PHPSESSID not found in Set-Cookie: ' + rawCookie[0]);
  }
  const sessionId = match[1];
  console.log('Extracted PHPSESSID:', sessionId);

  const cookieHeader = `PHPSESSID=${sessionId}`;

  // Today in YYYY-MM-DD
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  console.log('Today date:', todayStr);

  console.log('\n====================================================');
  console.log('▶ STEP 2: Downloading and Verifying the 3 CSV files...');
  console.log('====================================================');

  const csvTypes = ['mesures', 'alertes', 'notifications'];
  const csvOutputs = {};

  for (const type of csvTypes) {
    const url = `http://localhost/kizuna_water/exporter.php?type=${type}&du=${todayStr}&au=${todayStr}`;
    const res = await getUrl(url, { Cookie: cookieHeader });

    if (res.statusCode !== 200) {
      console.error(`ERROR downloading ${type}: status ${res.statusCode}`);
      console.error(res.data);
      continue;
    }

    const buf = res.buffer;
    // Check UTF-8 BOM: 0xEF, 0xBB, 0xBF
    const hasBom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
    console.log(`\n── [CSV: ${type.toUpperCase()}] ──`);
    console.log(`Content-Disposition: ${res.headers['content-disposition']}`);
    console.log(`Has UTF-8 BOM (Excel FR compatibility): ${hasBom ? 'YES (0xEF, 0xBB, 0xBF)' : 'NO'}`);

    const textContent = buf.toString('utf8');
    const lines = textContent.split(/\r?\n/);
    console.log(`Total lines: ${lines.length}`);
    console.log('--- First 5 Lines ---');
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      console.log(`Line ${i + 1}: ${lines[i]}`);
    }
    console.log('---------------------');

    // Save CSV to disk
    const outPath = path.resolve(`scratch/hydromind_${type}_${todayStr}.csv`);
    fs.writeFileSync(outPath, buf);
    csvOutputs[type] = { hasBom, lines: lines.slice(0, 5), path: outPath };
  }

  console.log('\n====================================================');
  console.log('▶ STEP 3: Launching Chrome for Visual Screenshots...');
  console.log('====================================================');

  const tempProfile = path.resolve('scratch/chrome_verify_profile');
  if (fs.existsSync(tempProfile)) {
    try { fs.rmSync(tempProfile, { recursive: true, force: true }); } catch (_) {}
  }

  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9224',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1400,900',
    `--user-data-dir=${tempProfile}`
  ]);

  await delay(2000);

  try {
    const versionRes = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9224/json', res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });

    const pageWsUrl = versionRes[0].webSocketDebuggerUrl;
    const client = new CDPClient(pageWsUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Network.enable');

    // Set authentication cookie
    await client.send('Network.setCookie', {
      name: 'PHPSESSID',
      value: sessionId,
      domain: 'localhost',
      path: '/kizuna_water/'
    });

    // ── Test Dashboard & Export Modal ─────────────────────────
    console.log('\n--> Navigating to Dashboard...');
    await client.navigate('http://localhost/kizuna_water/dashboard.html');
    await delay(1200);

    // Open export modal
    console.log('--> Opening Export Modal...');
    await client.evaluate('openExportModal()');
    await delay(500);

    // Capture Light theme
    await client.evaluate("document.documentElement.setAttribute('data-theme', 'light');");
    await delay(300);
    await client.screenshot(path.join(SCREENSHOT_DIR, 'dashboard_export_light.png'));

    // Capture Dark theme
    console.log('--> Switching to Dark theme...');
    await client.evaluate("document.documentElement.setAttribute('data-theme', 'dark');");
    await delay(300);
    await client.screenshot(path.join(SCREENSHOT_DIR, 'dashboard_export_dark.png'));

    // Capture Comfort theme
    console.log('--> Switching to Comfort theme...');
    await client.evaluate("document.documentElement.setAttribute('data-theme', 'comfort');");
    await delay(300);
    await client.screenshot(path.join(SCREENSHOT_DIR, 'dashboard_export_comfort.png'));

    // Test custom period selection
    console.log('--> Testing Custom period selection...');
    await client.evaluate(`
      const r = document.querySelector('input[name="exportPeriod"][value="custom"]');
      if (r) { r.checked = true; handlePeriodChange(); }
    `);
    await delay(300);
    const customDisplay = await client.evaluate("document.getElementById('customDateRow').style.display");
    console.log('Custom date row display:', customDisplay);

    // Test Japanese translation switch
    console.log('--> Testing Japanese language switch...');
    await client.evaluate(`
      if (window.KizunaI18n) {
        window.KizunaI18n.setLanguage('ja');
      }
    `);
    await delay(300);
    const heroTitleJa = await client.evaluate("document.querySelector('#overview h2')?.innerText || ''");
    console.log('Title in Japanese:', heroTitleJa);

    // Reset language to English
    await client.evaluate(`
      if (window.KizunaI18n) {
        window.KizunaI18n.setLanguage('en');
      }
    `);
    await delay(200);

    // ── Test rapport.php ──────────────────────────────────────
    console.log('\n--> Navigating to rapport.php...');
    await client.navigate(`http://localhost/kizuna_water/rapport.php?du=${todayStr}&au=${todayStr}`);
    await delay(1800); // Allow Chart.js to render

    // Light theme
    await client.evaluate("document.documentElement.setAttribute('data-theme', 'light');");
    await delay(300);
    await client.screenshot(path.join(SCREENSHOT_DIR, 'rapport_light.png'));

    // Dark theme
    console.log('--> rapport.php Dark theme...');
    await client.evaluate("document.documentElement.setAttribute('data-theme', 'dark');");
    await delay(300);
    await client.screenshot(path.join(SCREENSHOT_DIR, 'rapport_dark.png'));

    // Comfort theme
    console.log('--> rapport.php Comfort theme...');
    await client.evaluate("document.documentElement.setAttribute('data-theme', 'comfort');");
    await delay(300);
    await client.screenshot(path.join(SCREENSHOT_DIR, 'rapport_comfort.png'));

    // Print Preview (@media print emulation)
    console.log('--> Emulating @media print on rapport.php...');
    await client.send('Emulation.setEmulatedMedia', { media: 'print' });
    await delay(400);
    await client.screenshot(path.join(SCREENSHOT_DIR, 'rapport_print_preview.png'));

    // Generate A4 PDF
    console.log('--> Printing to A4 PDF...');
    await client.printPdf(path.join(SCREENSHOT_DIR, 'rapport_intervention_A4.pdf'));

    // Reset emulation
    await client.send('Emulation.setEmulatedMedia', { media: '' });

    console.log('\n====================================================');
    console.log('▶ Console Errors Count:', client.consoleErrors.length);
    if (client.consoleErrors.length > 0) {
      console.log('Errors:', client.consoleErrors);
    } else {
      console.log('✔ ZERO console errors detected!');
    }
    console.log('====================================================');

  } finally {
    chrome.kill('SIGKILL');
  }
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
