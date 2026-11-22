const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.resolve('screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function postForm(urlPath, postData) {
  return new Promise((resolve, reject) => {
    const postBody = new URLSearchParams(postData).toString();
    const req = http.request({
      hostname: 'localhost',
      port: 80,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postBody)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(postBody);
    req.end();
  });
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

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
    await delay(1200);
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return res.result?.value;
  }

  async screenshot(filePath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot: ${path.basename(filePath)} (${(fs.statSync(filePath).size / 1024).toFixed(1)} KB)`);
  }
}

async function main() {
  console.log('--- Launching Chrome in Headless Mode ---');
  const tempProfile = path.resolve('chrome_test_profile');
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1400,900',
    `--user-data-dir=${tempProfile}`
  ]);

  await delay(2000);

  try {
    const versionRes = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9222/json', res => {
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
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1400,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('\n=== 1. VERIFYING index.html ===');
    await client.navigate('http://localhost/kizuna_water/index.html');
    await delay(800);

    for (const theme of ['light', 'dark', 'comfort']) {
      await client.evaluate(`window.KizunaTheme.setTheme('${theme}');`);
      await delay(300);
      const activeAttr = await client.evaluate(`document.documentElement.getAttribute('data-theme')`);
      const stored = await client.evaluate(`localStorage.getItem('kizuna_theme')`);
      console.log(`[index.html] Theme: ${theme} | DOM: ${activeAttr} | Storage: ${stored}`);
      await client.screenshot(path.join(SCREENSHOT_DIR, `index_${theme}.png`));
    }

    // Test Language switch on index.html
    await client.evaluate(`window.KizunaI18n.setLanguage('jp');`);
    await delay(300);
    const jpText = await client.evaluate(`document.querySelector('.preview-heading h2')?.textContent`);
    console.log(`[index.html] JP Language switch verified: "${jpText}"`);
    await client.evaluate(`window.KizunaI18n.setLanguage('en');`);
    await delay(300);

    console.log('\n=== 2. VERIFYING auth.html ===');
    await client.navigate('http://localhost/kizuna_water/auth.html');
    await delay(800);

    for (const theme of ['light', 'dark', 'comfort']) {
      await client.evaluate(`window.KizunaTheme.setTheme('${theme}');`);
      await delay(300);
      const activeAttr = await client.evaluate(`document.documentElement.getAttribute('data-theme')`);
      console.log(`[auth.html] Theme: ${theme} | DOM: ${activeAttr}`);
      await client.screenshot(path.join(SCREENSHOT_DIR, `auth_${theme}.png`));
    }

    console.log('\n=== 3. VERIFYING dashboard.html (NORMAL state) ===');
    await postForm('/kizuna_water/controler_vanne.php', { statut_vanne: 'OUVERTE' });
    await client.navigate('http://localhost/kizuna_water/dashboard.html');
    await delay(1500);

    for (const theme of ['light', 'dark', 'comfort']) {
      await client.evaluate(`window.KizunaTheme.setTheme('${theme}');`);
      await delay(400);

      // Verify Chart.js and Map theme
      const chartColor = await client.evaluate(`(() => {
        const c = Chart.getChart('flowChart');
        return c ? c.data.datasets[0].borderColor : null;
      })()`);

      const tileUrl = await client.evaluate(`(() => {
        let url = '';
        if (mapState && mapState.map) {
          mapState.map.eachLayer(l => {
            if (l instanceof L.TileLayer) url = l._url;
          });
        }
        return url;
      })()`);

      console.log(`[dashboard.html - NORMAL] Theme: ${theme} | Chart Line: ${chartColor} | Tile: ${tileUrl}`);
      await client.screenshot(path.join(SCREENSHOT_DIR, `dashboard_normal_${theme}.png`));
    }

    console.log('\n=== 4. VERIFYING dashboard.html (ALERTE state) ===');
    await postForm('/kizuna_water/signaler_anomalie.php', {
      type: 'MICRO_FUITE',
      debit: '3.2',
      action: 'ALERTE'
    });
    await delay(1500); // Wait for telemetry poll

    for (const theme of ['light', 'dark', 'comfort']) {
      await client.evaluate(`window.KizunaTheme.setTheme('${theme}');`);
      await delay(400);
      console.log(`[dashboard.html - ALERTE] Theme: ${theme}`);
      await client.screenshot(path.join(SCREENSHOT_DIR, `dashboard_alerte_${theme}.png`));
    }

    console.log('\n=== 5. VERIFYING dashboard.html (FERMEE state) ===');
    await postForm('/kizuna_water/signaler_anomalie.php', {
      type: 'RUPTURE',
      debit: '9.5',
      action: 'FERMETURE'
    });
    await delay(1500); // Wait for telemetry poll

    for (const theme of ['light', 'dark', 'comfort']) {
      await client.evaluate(`window.KizunaTheme.setTheme('${theme}');`);
      await delay(400);
      console.log(`[dashboard.html - FERMEE] Theme: ${theme}`);
      await client.screenshot(path.join(SCREENSHOT_DIR, `dashboard_fermee_${theme}.png`));
    }

    // Reset back to NORMAL
    await postForm('/kizuna_water/controler_vanne.php', { statut_vanne: 'OUVERTE' });
    await delay(1000);

    console.log('\n=== 6. VERIFYING PERSISTENCE ACROSS RELOAD ===');
    await client.evaluate(`window.KizunaTheme.setTheme('dark');`);
    await client.navigate('http://localhost/kizuna_water/dashboard.html');
    await delay(1000);
    const persistedTheme = await client.evaluate(`document.documentElement.getAttribute('data-theme')`);
    console.log(`Reloaded theme: ${persistedTheme} (Expected: dark) -> ${persistedTheme === 'dark' ? 'SUCCESS' : 'FAILED'}`);

    console.log('\n=== 7. CONSOLE ERRORS AUDIT ===');
    if (client.consoleErrors.length === 0) {
      console.log('✅ ZERO CONSOLE ERRORS DETECTED across all pages and themes!');
    } else {
      console.log(`⚠️ Console errors detected (${client.consoleErrors.length}):`);
      client.consoleErrors.forEach(err => console.log('  -', err));
    }

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    chrome.kill();
    try {
      fs.rmSync(tempProfile, { recursive: true, force: true });
    } catch (e) {}
  }
}

main();
