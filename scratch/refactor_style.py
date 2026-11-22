with open('assets/style.css.orig', 'r', encoding='utf-8') as f:
    text = f.read()

replacements = [
    # Root
    ('--navy:#071d35;--navy2:#0d2b49;--blue:#087eBA;--cyan:#42c8e8;--ink:#122b42;--muted:#738497;--line:#e8eef3;--bg:#f5f8fb;--green:#20a879;--red:#e34d5b;',
     '--navy:var(--brand-navy);--navy2:var(--brand-navy2);--blue:var(--brand-blue);--cyan:var(--brand-cyan);--ink:var(--text-primary);--muted:var(--text-muted);--line:var(--border-default);--bg:var(--bg-dashboard);--green:var(--color-success);--red:var(--color-danger);'),

    # Site Header & Nav
    ('site-header{height:86px;padding:0 7.2%;display:flex;align-items:center;justify-content:space-between;background:#fff}',
     'site-header{height:86px;padding:0 7.2%;display:flex;align-items:center;justify-content:space-between;background:var(--bg-header)}'),
    ('.nav-links{display:flex;gap:35px;font-size:12px;color:#526579;font-weight:600}',
     '.nav-links{display:flex;gap:35px;font-size:12px;color:var(--text-secondary);font-weight:600}'),
    ('.nav-links a:hover{color:#087eba}',
     '.nav-links a:hover{color:var(--brand-blue)}'),

    # Buttons
    ('btn-primary{background:#087eBA;color:white;box-shadow:0 8px 22px #087eba28}',
     'btn-primary{background:var(--btn-primary-bg);color:var(--btn-primary-text);box-shadow:0 8px 22px var(--btn-primary-shadow)}'),
    ('btn-primary:hover{background:#066c9f;transform:translateY(-2px)}',
     'btn-primary:hover{background:var(--btn-primary-hover);transform:translateY(-2px)}'),
    ('btn-white{background:white;color:var(--navy)}',
     'btn-white{background:var(--btn-white-bg);color:var(--btn-white-text)}'),
    ('outline-btn{border:1px solid #dfe7ed;background:#fff;color:#61778a;border-radius:6px;padding:9px 12px;font-size:9px;font-weight:700}',
     'outline-btn{border:1px solid var(--btn-outline-border);background:var(--btn-outline-bg);color:var(--btn-outline-text);border-radius:6px;padding:9px 12px;font-size:9px;font-weight:700}'),
    ('outline-btn:hover{border-color:#1596c2;color:#087eba}',
     'outline-btn:hover{border-color:var(--btn-outline-hover-border);background:var(--btn-outline-hover-bg);color:var(--btn-outline-hover-text)}'),

    # Sidebar & Admin Base
    ('admin-body{background:#f5f7fa;min-height:100vh}',
     'admin-body{background:var(--bg-dashboard);color:var(--text-primary);min-height:100vh}'),
    ('sidebar{width:245px;background:#fff;border-right:1px solid #e9eef2;',
     'sidebar{width:245px;background:var(--bg-sidebar);border-right:1px solid var(--border-default);'),
    ('side-label{font-size:8px;letter-spacing:1.5px;font-weight:700;color:#a1adba;padding:0 12px 13px}',
     'side-label{font-size:8px;letter-spacing:1.5px;font-weight:700;color:var(--text-muted);padding:0 12px 13px}'),
    ('side-nav a{height:43px;padding:0 12px;display:flex;align-items:center;gap:13px;color:#758699;font-size:11px;font-weight:600;border-radius:7px}',
     'side-nav a{height:43px;padding:0 12px;display:flex;align-items:center;gap:13px;color:var(--text-secondary);font-size:11px;font-weight:600;border-radius:7px}'),
    ('side-nav a>span{font-size:17px;width:17px;text-align:center;color:#8b9baa}',
     'side-nav a>span{font-size:17px;width:17px;text-align:center;color:var(--text-muted)}'),
    ('side-nav a.active{background:#eaf6fa;color:#087eBA}',
     'side-nav a.active{background:var(--brand-blue-subtle);color:var(--brand-blue)}'),
    ('side-nav a.active>span{color:#087eBA}',
     'side-nav a.active>span{color:var(--brand-blue)}'),
    ('system-status{display:flex;align-items:center;gap:10px;padding:13px 9px;background:#f4faf8;border-radius:8px;margin-bottom:17px}',
     'system-status{display:flex;align-items:center;gap:10px;padding:13px 9px;background:var(--surface-subtle);border-radius:8px;margin-bottom:17px}'),
    ('system-status small{font-size:8px;color:#8a9aaa;margin-top:4px}',
     'system-status small{font-size:8px;color:var(--text-muted);margin-top:4px}'),
    ('profile{border-top:1px solid var(--line);padding:17px 3px 0;display:flex;align-items:center;gap:9px}',
     'profile{border-top:1px solid var(--border-default);padding:17px 3px 0;display:flex;align-items:center;gap:9px}'),
    ('profile-avatar,.top-avatar{width:32px;height:32px;border-radius:50%;background:#dff2f8;color:#087eBA;display:grid;place-items:center;font-size:10px;font-weight:800}',
     'profile-avatar,.top-avatar{width:32px;height:32px;border-radius:50%;background:var(--brand-blue-subtle);color:var(--brand-blue);display:grid;place-items:center;font-size:10px;font-weight:800}'),
    ('profile small{font-size:8px;color:#8797a6;margin-top:4px}',
     'profile small{font-size:8px;color:var(--text-muted);margin-top:4px}'),
    ('profile-more{margin-left:auto;color:#8292a1}',
     'profile-more{margin-left:auto;color:var(--text-muted)}'),

    # Admin Topbar
    ('admin-topbar h1{font:800 24px Manrope;color:#102b45;margin:0}',
     'admin-topbar h1{font:800 24px Manrope;color:var(--text-heading);margin:0}'),
    ('admin-topbar h1 span{color:#16a3cb;font-size:17px}',
     'admin-topbar h1 span{color:var(--brand-cyan);font-size:17px}'),
    ('admin-topbar p{font-size:11px;color:#8493a2;margin:7px 0 0}',
     'admin-topbar p{font-size:11px;color:var(--text-muted);margin:7px 0 0}'),
    ('.breadcrumb{font-size:9px;color:#8a9aaa;letter-spacing:.5px;margin-bottom:12px}',
     '.breadcrumb{font-size:9px;color:var(--text-muted);letter-spacing:.5px;margin-bottom:12px}'),

    # Cards & Panels
    ('stat-card,.panel{background:white;border:1px solid #e9eef2;border-radius:9px}',
     'stat-card,.panel{background:var(--surface-card);border:1px solid var(--border-default);border-radius:9px;box-shadow:var(--shadow-sm)}'),
    ('stat-top{display:flex;justify-content:space-between;align-items:center;color:#7c8d9d;font-size:9px;font-weight:600}',
     'stat-top{display:flex;justify-content:space-between;align-items:center;color:var(--text-secondary);font-size:9px;font-weight:600}'),
    ('stat-value strong{font:800 27px Manrope;color:#122e48;letter-spacing:-1px}',
     'stat-value strong{font:800 27px Manrope;color:var(--text-heading);letter-spacing:-1px}'),
    ('stat-value small{font-size:9px;color:#91a0ae}',
     'stat-value small{font-size:9px;color:var(--text-muted)}'),
    ('stat-value .valve-word{font-size:22px;color:#139d74}',
     'stat-value .valve-word{font-size:22px;color:var(--state-normal-accent)}'),
    ('.stat-foot{border-top:1px solid #f0f3f6;',
     '.stat-foot{border-top:1px solid var(--border-subtle);'),

    # Panel Headings & Charts
    ('panel-heading h2{font:700 13px Manrope;color:#18344d;margin:0}',
     'panel-heading h2{font:700 13px Manrope;color:var(--text-heading);margin:0}'),
    ('panel-heading p{font-size:9px;color:#92a0ad;margin:5px 0 0}',
     'panel-heading p{font-size:9px;color:var(--text-muted);margin:5px 0 0}'),
    ('chart-legend{display:flex;gap:13px;font-size:8px;color:#8494a2}',
     'chart-legend{display:flex;gap:13px;font-size:8px;color:var(--text-muted)}'),
    ('chart-meta>strong{font:800 22px Manrope;color:#18344d}',
     'chart-meta>strong{font:800 22px Manrope;color:var(--text-heading)}'),
    ('panel-link{font-size:9px;color:#087eba;font-weight:700}',
     'panel-link{font-size:9px;color:var(--brand-blue);font-weight:700}'),

    # Alert Items & Device rows
    ('alert-item{display:flex;align-items:center;gap:11px;padding:14px 0;border-bottom:1px solid #f0f3f6}',
     'alert-item{display:flex;align-items:center;gap:11px;padding:14px 0;border-bottom:1px solid var(--border-subtle)}'),
    ('alert-item b{font-size:9px;color:#344e65}',
     'alert-item b{font-size:9px;color:var(--text-heading)}'),
    ('alert-item p{font-size:8px;color:#8797a5;margin:4px 0}',
     'alert-item p{font-size:8px;color:var(--text-secondary);margin:4px 0}'),
    ('alert-item small{font-size:8px;color:#a6b1bb}',
     'alert-item small{font-size:8px;color:var(--text-muted)}'),
    ('device-row{display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid #f0f3f6}',
     'device-row{display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid var(--border-subtle)}'),
    ('device-row b{font-size:9px;color:#40586e}',
     'device-row b{font-size:9px;color:var(--text-heading)}'),
    ('device-row small{font-size:8px;color:#9aa7b2;margin-top:4px}',
     'device-row small{font-size:8px;color:var(--text-muted);margin-top:4px}'),
    ('device-online{font-size:8px;color:#159b76;font-weight:700}',
     'device-online{font-size:8px;color:var(--state-normal-accent);font-weight:700}'),

    # History Table
    ('history-table{width:100%;border-collapse:collapse;margin-top:13px;font-size:9px;color:#728596}',
     'history-table{width:100%;border-collapse:collapse;margin-top:13px;font-size:9px;color:var(--text-secondary)}'),
    ('history-table th{text-align:left;color:#9aa7b2;font-size:8px;font-weight:700;letter-spacing:.5px;padding:9px 10px;border-bottom:1px solid #edf1f4}',
     'history-table th{text-align:left;color:var(--text-muted);font-size:8px;font-weight:700;letter-spacing:.5px;padding:9px 10px;border-bottom:1px solid var(--border-default)}'),
    ('history-table td{padding:10px;border-bottom:1px solid #f0f3f6;white-space:nowrap}',
     'history-table td{padding:10px;border-bottom:1px solid var(--border-subtle);white-space:nowrap}'),
    ('history-table td:first-child{color:#8a9aaa}',
     'history-table td:first-child{color:var(--text-muted)}'),
    ('history-table td b{color:#2c536d}',
     'history-table td b{color:var(--text-heading)}'),

    # Footer
    ('admin-footer{display:flex;justify-content:space-between;color:#a0acb7;font-size:8px;padding:20px 2px 0}',
     'admin-footer{display:flex;justify-content:space-between;color:var(--text-muted);font-size:8px;padding:20px 2px 0}'),
    ('.site-footer{padding:30px 8%;display:flex;align-items:center;justify-content:space-between;font-size:10px;color:#8292a1}',
     '.site-footer{padding:30px 8%;display:flex;align-items:center;justify-content:space-between;font-size:10px;color:var(--text-secondary);border-top:1px solid var(--border-default);background:var(--bg-footer)}'),
    ('site-footer>a:last-child{color:#087eba;font-weight:700}',
     'site-footer>a:last-child{color:var(--brand-blue);font-weight:700}'),

    # Feature & Preview Cards on Public Landing
    ('.preview-card{background:#fff;border:1px solid #e1edf2;border-radius:12px;padding:23px;position:relative}',
     '.preview-card{background:var(--surface-card);border:1px solid var(--border-default);border-radius:12px;padding:23px;position:relative}'),
    ('.feature-card{padding:29px;border:1px solid var(--line);border-radius:10px;min-height:250px;background:#fff;transition:.25s}',
     '.feature-card{padding:29px;border:1px solid var(--border-default);border-radius:10px;min-height:250px;background:var(--surface-card);transition:.25s}'),
    ('feature-card.featured{background:#f0f9fc;border-color:#d7eff6}',
     'feature-card.featured{background:var(--surface-card-subtle);border-color:var(--border-interactive)}'),
    ('.trust-strip{min-height:78px;display:flex;align-items:center;justify-content:space-evenly;padding:15px 7%;border-bottom:1px solid var(--line);font-size:11px;color:#718497}',
     '.trust-strip{min-height:78px;display:flex;align-items:center;justify-content:space-evenly;padding:15px 7%;border-bottom:1px solid var(--border-default);font-size:11px;color:var(--text-secondary);background:var(--surface-card-subtle)}'),
]

for old, new in replacements:
    if old not in text:
        print(f"Warning: pattern not found: {old[:40]}")
    text = text.replace(old, new)

with open('assets/style.css', 'w', encoding='utf-8') as f:
    f.write(text)

print('assets/style.css successfully refactored!')
