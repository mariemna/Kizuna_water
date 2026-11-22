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

async function run() {
  console.log('=== Launching Chrome Headless for HydroMind Verification ===');
  const tempProfile = path.resolve('chrome_hm_profile');
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9223',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1440,920',
    `--user-data-dir=${tempProfile}`
  ]);

  await delay(2000);

  try {
    const versionRes = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9223/json', res => {
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
      width: 1440,
      height: 920,
      deviceScaleFactor: 1,
      mobile: false
    });

    // ─────────────────────────────────────────────────────────────
    // 1. index.html in Light, Dark, Comfort
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 1. Testing index.html ---');
    await client.navigate('http://localhost/kizuna_water/index.html');
    await delay(600);

    const indexTitle = await client.evaluate(`document.title`);
    console.log(`index.html <title>: "${indexTitle}"`);

    for (const theme of ['light', 'dark', 'comfort']) {
      await client.evaluate(`window.KizunaTheme.setTheme('${theme}');`);
      await delay(300);

      const logoVisible = await client.evaluate(`(() => {
        const lightImg = document.querySelector('.site-header .logo-light');
        const darkImg = document.querySelector('.site-header .logo-dark');
        return {
          theme: document.documentElement.getAttribute('data-theme'),
          lightDisplay: lightImg ? getComputedStyle(lightImg).display : null,
          darkDisplay: darkImg ? getComputedStyle(darkImg).display : null
        };
      })()`);
      console.log(`[index.html] Theme: ${theme} | Logos:`, JSON.stringify(logoVisible));
      await client.screenshot(path.join(SCREENSHOT_DIR, `index_${theme}.png`));
    }

    // Language switch test
    console.log('[index.html] Testing EN/JP language switch:');
    await client.evaluate(`window.KizunaI18n.setLanguage('jp');`);
    await delay(300);
    const jpPreviewText = await client.evaluate(`document.querySelector('.preview-heading h2')?.textContent`);
    console.log(`  JP Text: "${jpPreviewText}"`);
    await client.screenshot(path.join(SCREENSHOT_DIR, `index_jp.png`));
    await client.evaluate(`window.KizunaI18n.setLanguage('en');`);
    await delay(300);

    // ─────────────────────────────────────────────────────────────
    // 2. auth.html in Light, Dark, Comfort
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 2. Testing auth.html ---');
    await client.navigate('http://localhost/kizuna_water/auth.html');
    await delay(600);

    const authTitle = await client.evaluate(`document.title`);
    console.log(`auth.html <title>: "${authTitle}"`);

    for (const theme of ['light', 'dark', 'comfort']) {
      await client.evaluate(`window.KizunaTheme.setTheme('${theme}');`);
      await delay(300);

      const authLogos = await client.evaluate(`(() => {
        const cardLight = document.querySelector('.auth-card-logo .logo-light');
        const cardDark = document.querySelector('.auth-card-logo .logo-dark');
        return {
          theme: document.documentElement.getAttribute('data-theme'),
          cardLightDisplay: cardLight ? getComputedStyle(cardLight).display : null,
          cardDarkDisplay: cardDark ? getComputedStyle(cardDark).display : null
        };
      })()`);
      console.log(`[auth.html] Theme: ${theme} | Card Logo:`, JSON.stringify(authLogos));
      await client.screenshot(path.join(SCREENSHOT_DIR, `auth_${theme}.png`));
    }

    // ─────────────────────────────────────────────────────────────
    // 3. dashboard.html in Light, Dark, Comfort (Overview selected)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 3. Testing dashboard.html (Overview) ---');
    await client.navigate('http://localhost/kizuna_water/dashboard.html');
    await delay(1200);

    const dashTitle = await client.evaluate(`document.title`);
    console.log(`dashboard.html <title>: "${dashTitle}"`);

    for (const theme of ['light', 'dark', 'comfort']) {
      await client.evaluate(`window.KizunaTheme.setTheme('${theme}');`);
      await delay(400);

      const activeNav = await client.evaluate(`(() => {
        const activeEl = document.querySelector('.side-nav a.active');
        return {
          text: activeEl ? activeEl.textContent.trim() : null,
          href: activeEl ? activeEl.getAttribute('href') : null,
          ariaCurrent: activeEl ? activeEl.getAttribute('aria-current') : null
        };
      })()`);
      console.log(`[dashboard.html] Theme: ${theme} | Active Item:`, JSON.stringify(activeNav));
      await client.screenshot(path.join(SCREENSHOT_DIR, `dashboard_${theme}.png`));
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Sidebar: Click on "Alerts" in Light, Dark, Comfort
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 4. Testing Sidebar: Click on "Alerts" ---');
    for (const theme of ['light', 'dark', 'comfort']) {
      await client.evaluate(`window.KizunaTheme.setTheme('${theme}');`);
      await delay(200);

      // Click on Alerts nav item
      await client.evaluate(`(() => {
        const alertsLink = document.querySelector('.side-nav a[href="#alerts"]');
        if (alertsLink) alertsLink.click();
      })()`);
      await delay(500);

      const alertsActive = await client.evaluate(`(() => {
        const activeEl = document.querySelector('.side-nav a.active');
        return {
          text: activeEl ? activeEl.textContent.trim() : null,
          href: activeEl ? activeEl.getAttribute('href') : null,
          ariaCurrent: activeEl ? activeEl.getAttribute('aria-current') : null
        };
      })()`);
      console.log(`[sidebar-click-alerts] Theme: ${theme} | Active:`, JSON.stringify(alertsActive));
      await client.screenshot(path.join(SCREENSHOT_DIR, `sidebar_alerts_${theme}.png`));
    }

    // ─────────────────────────────────────────────────────────────
    // 5. Sidebar: Scroll to "History" in Light, Dark, Comfort
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 5. Testing Sidebar: Scroll to "History" ---');
    for (const theme of ['light', 'dark', 'comfort']) {
      await client.evaluate(`window.KizunaTheme.setTheme('${theme}');`);
      await delay(200);

      // Scroll to history section
      await client.evaluate(`(() => {
        const historySec = document.getElementById('history');
        if (historySec) historySec.scrollIntoView({ behavior: 'auto' });
      })()`);
      await delay(600);

      const historyActive = await client.evaluate(`(() => {
        const activeEl = document.querySelector('.side-nav a.active');
        return {
          text: activeEl ? activeEl.textContent.trim() : null,
          href: activeEl ? activeEl.getAttribute('href') : null,
          ariaCurrent: activeEl ? activeEl.getAttribute('aria-current') : null
        };
      })()`);
      console.log(`[sidebar-scroll-history] Theme: ${theme} | Active:`, JSON.stringify(historyActive));
      await client.screenshot(path.join(SCREENSHOT_DIR, `sidebar_history_${theme}.png`));
    }

    // ─────────────────────────────────────────────────────────────
    // 6. Console Errors Audit
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 6. Console Error Audit ---');
    if (client.consoleErrors.length === 0) {
      console.log('✅ ZERO CONSOLE ERRORS DETECTED across all pages, themes, and interactions!');
    } else {
      console.log(`⚠️ Console errors detected (${client.consoleErrors.length}):`);
      client.consoleErrors.forEach(err => console.log('  -', err));
    }

  } catch (err) {
    console.error('Execution error:', err);
  } finally {
    chrome.kill();
    try {
      fs.rmSync(tempProfile, { recursive: true, force: true });
    } catch (e) {}
  }
}

run();
