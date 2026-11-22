import re

# ── 1. UPDATE index.html ──────────────────────────────────────
with open('index.html.orig', 'r', encoding='utf-8') as f:
    index_html = f.read()

fouc_script = '''  <script>
    (function(){try{var s=localStorage.getItem('kizuna_theme');var t=s||((window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();
  </script>
'''

themes_link = '  <link rel="stylesheet" href="assets/themes.css?v=20261121">\n'

theme_switcher_html = '''
<div class="theme-switcher" role="radiogroup" aria-label="Theme switcher">
  <button type="button" data-theme-value="light" aria-label="Light theme" title="Light theme">☀️ <span>Light</span></button>
  <button type="button" data-theme-value="dark" aria-label="Dark theme" title="Dark theme">🌙 <span>Dark</span></button>
  <button type="button" data-theme-value="comfort" aria-label="Eye comfort theme" title="Eye comfort theme">👁️ <span>Comfort</span></button>
</div>
'''

theme_script = '<script src="assets/theme.js?v=20261121"></script>\n'

# Insert fouc_script after <head>
index_html = index_html.replace('<head>\n', '<head>\n' + fouc_script)
# Insert themes_link before style.css
index_html = index_html.replace('  <link rel="stylesheet" href="assets/style.css', themes_link + '  <link rel="stylesheet" href="assets/style.css')
# Insert theme_switcher before </body>
index_html = index_html.replace('</body>', theme_switcher_html + theme_script + '</body>')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(index_html)
print('index.html updated!')

# ── 2. UPDATE auth.html ───────────────────────────────────────
with open('auth.html.orig', 'r', encoding='utf-8') as f:
    auth_html = f.read()

# Insert fouc_script after <head>
auth_html = auth_html.replace('<head>\n', '<head>\n' + fouc_script)
# Insert themes_link before style.css
auth_html = auth_html.replace('  <link rel="stylesheet" href="assets/style.css">', themes_link + '  <link rel="stylesheet" href="assets/style.css">')

# Refactor inline <style> in auth.html
old_auth_style = '''    .auth-page {
      min-height: 100vh;
      background: radial-gradient(ellipse at 80% 20%, #123d60 0, #0b2b49 35%, #071d35 75%);
      color: #fff;
      display: flex;
      flex-direction: column;
    }
    .auth-header {
      padding: 24px 8%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: transparent;
    }
    .auth-header .brand {
      color: #fff;
    }
    .auth-header .brand-mark {
      background: #0d2b49;
      border: 1px solid #1a4f78;
    }
    .auth-header .brand b {
      color: #4ed1e9;
    }
    .auth-container {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 30px 16px 60px;
    }
    .auth-card {
      width: 100%;
      max-width: 480px;
      background: #ffffff;
      color: var(--ink);
      border-radius: 12px;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.45);
      padding: 36px 32px;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }
    .auth-tabs {
      display: flex;
      gap: 8px;
      background: #f0f4f8;
      border-radius: 8px;
      padding: 4px;
      margin-bottom: 24px;
    }
    .auth-tab-btn {
      flex: 1;
      padding: 10px 14px;
      border: none;
      background: transparent;
      border-radius: 6px;
      font-weight: 700;
      font-size: 11px;
      color: #6a7c8e;
      cursor: pointer;
      transition: all 0.2s;
    }
    .auth-tab-btn.active {
      background: #fff;
      color: var(--navy);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
    .auth-title {
      font: 800 22px Manrope;
      color: var(--navy);
      margin: 0 0 6px;
    }
    .auth-subtitle {
      font-size: 11px;
      color: #7b8c9c;
      margin: 0 0 20px;
      line-height: 1.5;
    }
    .form-group {
      margin-bottom: 15px;
    }
    .form-group label {
      display: block;
      font-size: 10px;
      font-weight: 700;
      color: #40586e;
      margin-bottom: 5px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .form-input {
      width: 100%;
      padding: 11px 13px;
      border: 1px solid #dce4eb;
      border-radius: 7px;
      font-family: inherit;
      font-size: 12px;
      color: var(--ink);
      background: #fdfefe;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .form-input:focus {
      outline: none;
      border-color: #087eBA;
      box-shadow: 0 0 0 3px rgba(8, 126, 186, 0.12);
      background: #fff;
    }
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .quick-fill-btn {
      width: 100%;
      background: #eef7fa;
      border: 1px dashed #168dbb;
      color: #087eBA;
      padding: 9px 12px;
      border-radius: 7px;
      font-size: 10px;
      font-weight: 700;
      cursor: pointer;
      margin-bottom: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: background 0.2s;
    }
    .quick-fill-btn:hover {
      background: #e0f2f8;
    }
    .checkbox-card {
      border: 1px solid #e5ecf0;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 10px;
      background: #fbfdfe;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      cursor: pointer;
    }
    .checkbox-card input[type="checkbox"] {
      margin-top: 3px;
      accent-color: #087eBA;
      width: 15px;
      height: 15px;
      cursor: pointer;
    }
    .checkbox-card-info b {
      display: block;
      font-size: 11px;
      color: #2c445a;
    }
    .checkbox-card-info small {
      display: block;
      font-size: 9px;
      color: #8495a4;
      margin-top: 2px;
      line-height: 1.4;
    }
    .auth-alert {
      padding: 11px 14px;
      border-radius: 7px;
      font-size: 11px;
      margin-bottom: 16px;
      display: none;
    }
    .auth-alert.error {
      background: #fff0ef;
      color: #d94d59;
      border: 1px solid #fbd9d7;
      display: block;
    }
    .auth-alert.success {
      background: #e8f8f2;
      color: #159b76;
      border: 1px solid #c9eedf;
      display: block;
    }
    .auth-footer-nav {
      margin-top: 20px;
      text-align: center;
      font-size: 11px;
      color: #8a9aaa;
    }
    .auth-footer-nav a {
      color: #087eBA;
      font-weight: 700;
    }'''

new_auth_style = '''    .auth-page {
      min-height: 100vh;
      background: var(--auth-bg);
      color: var(--hero-text);
      display: flex;
      flex-direction: column;
    }
    .auth-header {
      padding: 24px 8%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: transparent;
    }
    .auth-header .brand {
      color: var(--hero-text);
    }
    .auth-header .brand-mark {
      background: var(--brand-navy2);
      border: 1px solid var(--border-interactive);
    }
    .auth-header .brand b {
      color: var(--brand-cyan);
    }
    .auth-container {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 30px 16px 60px;
    }
    .auth-card {
      width: 100%;
      max-width: 480px;
      background: var(--surface-card);
      color: var(--text-primary);
      border-radius: 12px;
      box-shadow: var(--shadow-lg);
      padding: 36px 32px;
      border: 1px solid var(--auth-card-border);
    }
    .auth-tabs {
      display: flex;
      gap: 8px;
      background: var(--surface-subtle);
      border-radius: 8px;
      padding: 4px;
      margin-bottom: 24px;
    }
    .auth-tab-btn {
      flex: 1;
      padding: 10px 14px;
      border: none;
      background: transparent;
      border-radius: 6px;
      font-weight: 700;
      font-size: 11px;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.2s;
    }
    .auth-tab-btn.active {
      background: var(--surface-card);
      color: var(--text-heading);
      box-shadow: var(--shadow-sm);
    }
    .auth-title {
      font: 800 22px Manrope;
      color: var(--text-heading);
      margin: 0 0 6px;
    }
    .auth-subtitle {
      font-size: 11px;
      color: var(--text-muted);
      margin: 0 0 20px;
      line-height: 1.5;
    }
    .form-group {
      margin-bottom: 15px;
    }
    .form-group label {
      display: block;
      font-size: 10px;
      font-weight: 700;
      color: var(--text-secondary);
      margin-bottom: 5px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .form-input {
      width: 100%;
      padding: 11px 13px;
      border: 1px solid var(--input-border);
      border-radius: 7px;
      font-family: inherit;
      font-size: 12px;
      color: var(--input-text);
      background: var(--input-bg);
      transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
    }
    .form-input:focus {
      outline: none;
      border-color: var(--brand-blue);
      box-shadow: 0 0 0 3px var(--input-focus-ring);
      background: var(--input-bg-focus);
    }
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .quick-fill-btn {
      width: 100%;
      background: var(--brand-blue-subtle);
      border: 1px dashed var(--brand-blue);
      color: var(--brand-blue);
      padding: 9px 12px;
      border-radius: 7px;
      font-size: 10px;
      font-weight: 700;
      cursor: pointer;
      margin-bottom: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: background 0.2s;
    }
    .quick-fill-btn:hover {
      background: var(--surface-subtle-hover);
    }
    .checkbox-card {
      border: 1px solid var(--border-default);
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 10px;
      background: var(--surface-card-subtle);
      display: flex;
      align-items: flex-start;
      gap: 10px;
      cursor: pointer;
    }
    .checkbox-card input[type="checkbox"] {
      margin-top: 3px;
      accent-color: var(--brand-blue);
      width: 15px;
      height: 15px;
      cursor: pointer;
    }
    .checkbox-card-info b {
      display: block;
      font-size: 11px;
      color: var(--text-heading);
    }
    .checkbox-card-info small {
      display: block;
      font-size: 9px;
      color: var(--text-muted);
      margin-top: 2px;
      line-height: 1.4;
    }
    .auth-alert {
      padding: 11px 14px;
      border-radius: 7px;
      font-size: 11px;
      margin-bottom: 16px;
      display: none;
    }
    .auth-alert.error {
      background: var(--color-danger-bg);
      color: var(--color-danger);
      border: 1px solid var(--state-fermee-border);
      display: block;
    }
    .auth-alert.success {
      background: var(--color-success-bg);
      color: var(--color-success);
      border: 1px solid var(--state-normal-border);
      display: block;
    }
    .auth-footer-nav {
      margin-top: 20px;
      text-align: center;
      font-size: 11px;
      color: var(--text-muted);
    }
    .auth-footer-nav a {
      color: var(--brand-blue);
      font-weight: 700;
    }'''

assert old_auth_style in auth_html, 'Old auth style not matched!'
auth_html = auth_html.replace(old_auth_style, new_auth_style)

# Insert theme_switcher and theme_script before </body>
auth_html = auth_html.replace('</body>', theme_switcher_html + theme_script + '</body>')

with open('auth.html', 'w', encoding='utf-8') as f:
    f.write(auth_html)
print('auth.html updated!')

# ── 3. UPDATE dashboard.html ───────────────────────────────────
with open('dashboard.html.orig', 'r', encoding='utf-8') as f:
    dash_html = f.read()

# Insert fouc_script after <head>
dash_html = dash_html.replace('<head>\n', '<head>\n' + fouc_script)
# Insert themes_link before style.css
dash_html = dash_html.replace('  <link rel="stylesheet" href="assets/style.css', themes_link + '  <link rel="stylesheet" href="assets/style.css')

old_dash_style = '''  <style>
    .alert-banner.state-normal { background: #effaf5; border-color: #d8f0e5; }
    .alert-banner.state-normal .alert-emblem { background: #d9f5e8; color: #13966c; }
    .alert-banner.state-normal b { color: #16835f; }
    .alert-banner.state-normal p { color: #629b85; }
    .alert-banner.state-normal .alert-time { color: #13966c; }
    .alert-banner.state-normal button { color: #13966c; }

    .alert-banner.state-alerte { background: #fff8ed; border-color: #f8dfb6; }
    .alert-banner.state-alerte .alert-emblem { background: #faeacc; color: #c97a16; }
    .alert-banner.state-alerte b { color: #ad6508; }
    .alert-banner.state-alerte p { color: #946322; }
    .alert-banner.state-alerte .alert-time { color: #c97a16; }
    .alert-banner.state-alerte button { color: #c97a16; }

    .alert-banner.state-fermee { background: #fff4f2; border-color: #f9d9d5; }
    .alert-banner.state-fermee .alert-emblem { background: #ffe1dc; color: #d84b53; }
    .alert-banner.state-fermee b { color: #9e343d; }
    .alert-banner.state-fermee p { color: #a76b70; }
    .alert-banner.state-fermee .alert-time { color: #bd777b; }
    .alert-banner.state-fermee button { color: #bb4850; }

    .leak-card.state-alerte { border-color: #f8dfb6; background: #fffdf8; }
    .leak-card.state-alerte .severity-dot { background: #f2a34a; box-shadow: 0 0 0 4px rgba(242, 163, 74, 0.2); }
    .leak-card.state-alerte #mapStatus { color: #ad6508; }

    .severity.warning-severity { color: #c97a16; background: #fdf2e2; }
    .severity.normal-severity { color: #16835f; background: #eaf8f1; }
    .alert-type.warning { background: #faeacc; color: #c97a16; }
    .alert-type.normal { background: #d9f5e8; color: #13966c; }
  </style>'''

new_dash_style = '''  <style>
    .alert-banner.state-normal { background: var(--state-normal-bg); border-color: var(--state-normal-border); }
    .alert-banner.state-normal .alert-emblem { background: var(--state-normal-emblem-bg); color: var(--state-normal-accent); }
    .alert-banner.state-normal b { color: var(--state-normal-text); }
    .alert-banner.state-normal p { color: var(--state-normal-muted); }
    .alert-banner.state-normal .alert-time { color: var(--state-normal-accent); }
    .alert-banner.state-normal button { color: var(--state-normal-accent); }

    .alert-banner.state-alerte { background: var(--state-alerte-bg); border-color: var(--state-alerte-border); }
    .alert-banner.state-alerte .alert-emblem { background: var(--state-alerte-emblem-bg); color: var(--state-alerte-accent); }
    .alert-banner.state-alerte b { color: var(--state-alerte-text); }
    .alert-banner.state-alerte p { color: var(--state-alerte-muted); }
    .alert-banner.state-alerte .alert-time { color: var(--state-alerte-accent); }
    .alert-banner.state-alerte button { color: var(--state-alerte-accent); }

    .alert-banner.state-fermee { background: var(--state-fermee-bg); border-color: var(--state-fermee-border); }
    .alert-banner.state-fermee .alert-emblem { background: var(--state-fermee-emblem-bg); color: var(--state-fermee-accent); }
    .alert-banner.state-fermee b { color: var(--state-fermee-text); }
    .alert-banner.state-fermee p { color: var(--state-fermee-muted); }
    .alert-banner.state-fermee .alert-time { color: var(--state-fermee-muted); }
    .alert-banner.state-fermee button { color: var(--state-fermee-accent); }

    .leak-card.state-alerte { border-color: var(--state-alerte-border); background: var(--surface-card); }
    .leak-card.state-alerte .severity-dot { background: var(--state-alerte-dot); box-shadow: 0 0 0 4px var(--state-alerte-glow); }
    .leak-card.state-alerte #mapStatus { color: var(--state-alerte-text); }

    .severity.warning-severity { color: var(--state-alerte-accent); background: var(--state-alerte-emblem-bg); }
    .severity.normal-severity { color: var(--state-normal-accent); background: var(--state-normal-emblem-bg); }
    .alert-type.warning { background: var(--state-alerte-emblem-bg); color: var(--state-alerte-accent); }
    .alert-type.normal { background: var(--state-normal-emblem-bg); color: var(--state-normal-accent); }
  </style>'''

assert old_dash_style in dash_html, 'Old dash style not matched!'
dash_html = dash_html.replace(old_dash_style, new_dash_style)

# Refactor settings inline styles to semantic classes and variables
dash_html = dash_html.replace(
    '<button class="outline-btn" type="button" onclick="handleLogout()" id="logoutBtn" style="color:#d94d59; border-color:#f9d9d5; font-size:9px; padding:7px 10px;">Sign Out</button>',
    '<button class="outline-btn" type="button" onclick="handleLogout()" id="logoutBtn" style="color:var(--color-danger); border-color:var(--state-fermee-border); font-size:9px; padding:7px 10px;">Sign Out</button>'
)

dash_html = dash_html.replace(
    '<div style="background:#fcfdfe; border:1px solid #e9eef2; border-radius:8px; padding:16px;">\n        <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">\n          <div class="profile-avatar" id="settingsAvatar" style="width:40px; height:40px; font-size:13px;">YT</div>\n          <div>\n            <b id="settingsWorkerName" style="font-size:12px; color:#18344d; display:block;">Yassine Trabelsi (Technicien)</b>\n            <span id="settingsWorkerEmail" style="font-size:10px; color:#7c8d9d;">technicien@kizuna.tn</span>\n          </div>\n        </div>',
    '<div class="kz-settings-card">\n        <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">\n          <div class="profile-avatar" id="settingsAvatar" style="width:40px; height:40px; font-size:13px;">YT</div>\n          <div>\n            <b id="settingsWorkerName" style="font-size:12px; color:var(--text-heading); display:block;">Yassine Trabelsi (Technicien)</b>\n            <span id="settingsWorkerEmail" style="font-size:10px; color:var(--text-muted);">technicien@kizuna.tn</span>\n          </div>\n        </div>'
)

dash_html = dash_html.replace(
    '<label style="font-size:9px; font-weight:700; color:#40586e; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:4px;">Full Name</label>\n          <input class="form-input" type="text" id="prefNom" style="width:100%; padding:8px 11px; border:1px solid #dce4eb; border-radius:6px; font-size:11px;" value="Yassine Trabelsi">',
    '<label class="kz-field-label">Full Name</label>\n          <input class="form-input kz-field-input" type="text" id="prefNom" value="Yassine Trabelsi">'
)

dash_html = dash_html.replace(
    '<label style="font-size:9px; font-weight:700; color:#40586e; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:4px;">Assigned Intervention Sector</label>\n          <input class="form-input" type="text" id="prefSecteur" style="width:100%; padding:8px 11px; border:1px solid #dce4eb; border-radius:6px; font-size:11px;" value="Secteur A — Zone ESPRIT / El Ghazala">',
    '<label class="kz-field-label">Assigned Intervention Sector</label>\n          <input class="form-input kz-field-input" type="text" id="prefSecteur" value="Secteur A — Zone ESPRIT / El Ghazala">'
)

dash_html = dash_html.replace(
    '<div style="background:#f4faf8; border:1px solid #d6eee4; border-radius:6px; padding:10px; margin-top:12px;">\n          <small style="color:#159b76; font-weight:700; display:block; font-size:9px;">💡 Hackathon Demo Tip</small>\n          <span style="font-size:9px; color:#5b7c6f; line-height:1.4; display:block; margin-top:3px;">',
    '<div class="kz-tip-box">\n          <small class="kz-tip-title">💡 Hackathon Demo Tip</small>\n          <span class="kz-tip-desc">'
)

dash_html = dash_html.replace(
    '<div style="background:#fcfdfe; border:1px solid #e9eef2; border-radius:8px; padding:16px;">\n        <h3 style="font:700 12px Manrope; color:#18344d; margin:0 0 12px;">Emergency Notification Preferences</h3>',
    '<div class="kz-settings-card">\n        <h3 class="kz-settings-title">Emergency Notification Preferences</h3>'
)

dash_html = dash_html.replace(
    '<div style="border:1px solid #e5ecf0; border-radius:7px; padding:10px 12px; margin-bottom:12px; background:#fff;">',
    '<div class="kz-channel-card">'
)

dash_html = dash_html.replace(
    '<label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:700; font-size:11px; color:#18344d; margin:0;">\n              <input type="checkbox" id="prefNotifySms" checked style="accent-color:#087eBA; width:15px; height:15px;">',
    '<label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:700; font-size:11px; color:var(--text-heading); margin:0;">\n              <input type="checkbox" id="prefNotifySms" checked style="accent-color:var(--brand-blue); width:15px; height:15px;">'
)

dash_html = dash_html.replace(
    '<span style="font-size:8px; font-weight:700; padding:2px 6px; border-radius:4px; background:#eef7fa; color:#168dbb;">PLAIN TEXT · NO LINK</span>',
    '<span style="font-size:8px; font-weight:700; padding:2px 6px; border-radius:4px; background:var(--brand-blue-subtle); color:var(--brand-blue);">PLAIN TEXT · NO LINK</span>'
)

dash_html = dash_html.replace(
    '<p style="font-size:9px; color:#8495a4; margin:0 0 8px; line-height:1.4;">',
    '<p style="font-size:9px; color:var(--text-muted); margin:0 0 8px; line-height:1.4;">'
)

dash_html = dash_html.replace(
    '<label for="prefTel" style="font-size:9px; font-weight:700; color:#5a6e80; white-space:nowrap;">Mobile Number:</label>\n            <input class="form-input" type="tel" id="prefTel" style="flex:1; padding:7px 10px; border:1px solid #dce4eb; border-radius:6px; font-size:11px;" placeholder="+216 20 123 456" value="+21620123456">',
    '<label for="prefTel" style="font-size:9px; font-weight:700; color:var(--text-secondary); white-space:nowrap;">Mobile Number:</label>\n            <input class="form-input" type="tel" id="prefTel" style="flex:1; padding:7px 10px; border:1px solid var(--input-border); border-radius:6px; font-size:11px; background:var(--input-bg); color:var(--input-text);" placeholder="+216 20 123 456" value="+21620123456">'
)

dash_html = dash_html.replace(
    '<div style="border:1px solid #e5ecf0; border-radius:7px; padding:10px 12px; margin-bottom:14px; background:#fff;">',
    '<div class="kz-channel-card">'
)

dash_html = dash_html.replace(
    '<label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:700; font-size:11px; color:#18344d; margin:0;">\n              <input type="checkbox" id="prefNotifyTelegram" checked style="accent-color:#087eBA; width:15px; height:15px;">',
    '<label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:700; font-size:11px; color:var(--text-heading); margin:0;">\n              <input type="checkbox" id="prefNotifyTelegram" checked style="accent-color:var(--brand-blue); width:15px; height:15px;">'
)

dash_html = dash_html.replace(
    '<span style="font-size:8px; font-weight:700; padding:2px 6px; border-radius:4px; background:#e8f8f2; color:#159b76;">GPS MAPS LINK</span>',
    '<span style="font-size:8px; font-weight:700; padding:2px 6px; border-radius:4px; background:var(--state-normal-badge-bg); color:var(--state-normal-badge-text);">GPS MAPS LINK</span>'
)

dash_html = dash_html.replace(
    '<label for="prefTelegram" style="font-size:9px; font-weight:700; color:#5a6e80; white-space:nowrap;">Chat ID:</label>\n            <input class="form-input" type="text" id="prefTelegram" style="flex:1; padding:7px 10px; border:1px solid #dce4eb; border-radius:6px; font-size:11px;" placeholder="ex: 123456789" value="123456789">',
    '<label for="prefTelegram" style="font-size:9px; font-weight:700; color:var(--text-secondary); white-space:nowrap;">Chat ID:</label>\n            <input class="form-input" type="text" id="prefTelegram" style="flex:1; padding:7px 10px; border:1px solid var(--input-border); border-radius:6px; font-size:11px; background:var(--input-bg); color:var(--input-text);" placeholder="ex: 123456789" value="123456789">'
)

dash_html = dash_html.replace(
    '<button class="outline-btn" type="button" onclick="testNotificationAlert()" id="testNotifBtn" style="padding:10px 12px; font-size:10px; color:#168dbb; border-color:#168dbb;" title="Trigger an immediate test alert">',
    '<button class="outline-btn" type="button" onclick="testNotificationAlert()" id="testNotifBtn" style="padding:10px 12px; font-size:10px; color:var(--brand-blue); border-color:var(--brand-blue);" title="Trigger an immediate test alert">'
)

# Insert theme_switcher and theme_script before </body>
dash_html = dash_html.replace('</body>', theme_switcher_html + theme_script + '</body>')

with open('dashboard.html', 'w', encoding='utf-8') as f:
    f.write(dash_html)
print('dashboard.html updated!')
