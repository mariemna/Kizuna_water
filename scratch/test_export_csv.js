const http = require('http');

function postJson(url, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function getWithCookie(url, cookie) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + (u.search || ''),
      method: 'GET',
      headers: {
        'Cookie': cookie
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const loginRes = await postJson('http://localhost/kizuna_water/login.php', {
    email: 'technicien@kizuna.tn',
    password: 'Kizuna2026!'
  });
  console.log('Login status:', loginRes.status);
  const cookie = loginRes.headers['set-cookie'][0].split(';')[0];

  const exportRes = await getWithCookie('http://localhost/kizuna_water/exporter.php?type=mesures', cookie);
  console.log('Export status:', exportRes.status);
  const lines = exportRes.body.split('\n').slice(0, 5);
  console.log('--- FIRST LINES OF CSV MESURES ---');
  lines.forEach((l, i) => console.log('Line ' + (i+1) + ': ' + l));
}
run().catch(console.error);
