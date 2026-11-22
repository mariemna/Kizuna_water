with open('assets/style.css', 'r', encoding='utf-8') as f:
    text = f.read()

replacements = [
    # Live preview section
    ('.live-preview{background:#f1f8fb;', '.live-preview{background:var(--bg-section);'),
    ('.preview-heading em{font-style:normal;color:#159bc7}', '.preview-heading em{font-style:normal;color:var(--brand-cyan)}'),
    ('.preview-link{color:#087eba}', '.preview-link{color:var(--brand-blue)}'),
    ('.preview-card-head{display:flex;justify-content:space-between;align-items:center;color:#183b54;font-size:9px;font-weight:700}',
     '.preview-card-head{display:flex;justify-content:space-between;align-items:center;color:var(--text-heading);font-size:9px;font-weight:700}'),
    ('.preview-card-head b{color:#9aaab5;font-weight:500;letter-spacing:0}',
     '.preview-card-head b{color:var(--text-muted);font-weight:500;letter-spacing:0}'),
    ('.preview-flow strong{font:800 42px Manrope;color:#143a53;letter-spacing:-2px}',
     '.preview-flow strong{font:800 42px Manrope;color:var(--text-heading);letter-spacing:-2px}'),
    ('.preview-flow small{font-size:10px;color:#93a3af}',
     '.preview-flow small{font-size:10px;color:var(--text-muted)}'),
    ('.preview-card>p{margin:18px 0 0;font-size:11px;color:#7e8f9e;line-height:1.7}',
     '.preview-card>p{margin:18px 0 0;font-size:11px;color:var(--text-secondary);line-height:1.7}'),
    ('.preview-number{display:block;font:800 34px Manrope;color:#183b53;letter-spacing:-1px;margin:21px 0 6px}',
     '.preview-number{display:block;font:800 34px Manrope;color:var(--text-heading);letter-spacing:-1px;margin:21px 0 6px}'),
    ('.preview-card.preview-alert{border-color:#fae0bc;background:#fffdf9}',
     '.preview-card.preview-alert{border-color:var(--state-alerte-border);background:var(--state-alerte-bg)}'),
    ('.preview-card.preview-alert>strong{font:800 34px Manrope;color:#ad6508;display:block;margin:21px 0 6px}',
     '.preview-card.preview-alert>strong{font:800 34px Manrope;color:var(--state-alerte-text);display:block;margin:21px 0 6px}'),
    ('.preview-card.preview-alert>a{display:inline-block;margin-top:14px;color:#c97a16;font-size:10px;font-weight:700}',
     '.preview-card.preview-alert>a{display:inline-block;margin-top:14px;color:var(--state-alerte-accent);font-size:10px;font-weight:700}'),
    ('.preview-card.preview-alert small{color:#9d6f34}',
     '.preview-card.preview-alert small{color:var(--state-alerte-muted)}'),

    # Alert types & severities
    ('.alert-type{height:27px;width:27px;border-radius:8px;background:#fff0ef;color:#df535b;display:grid;place-items:center;font-weight:800}',
     '.alert-type{height:27px;width:27px;border-radius:8px;background:var(--color-danger-bg);color:var(--color-danger);display:grid;place-items:center;font-weight:800}'),
    ('.alert-type.info{background:#eaf6fb;color:#168dbb}',
     '.alert-type.info{background:var(--color-info-bg);color:var(--color-info)}'),
    ('.severity{font-size:7px;color:#d85a60;background:#fff0ef;border-radius:4px;padding:5px 6px;font-weight:700;letter-spacing:.5px}',
     '.severity{font-size:7px;color:var(--color-danger);background:var(--color-danger-bg);border-radius:4px;padding:5px 6px;font-weight:700;letter-spacing:.5px}'),
    ('.info-severity{color:#168dbb;background:#eaf6fb}',
     '.info-severity{color:var(--color-info);background:var(--color-info-bg)}'),
    ('.device-icon{height:29px;width:29px;border-radius:8px;background:#eef7fa;color:#168dbb;display:grid;place-items:center;font-size:17px}',
     '.device-icon{height:29px;width:29px;border-radius:8px;background:var(--brand-blue-subtle);color:var(--brand-blue);display:grid;place-items:center;font-size:17px}'),

    # Leak card & sensor card
    ('.leak-card{border:1px solid #f3d9d8;background:linear-gradient(145deg,#fffafa,#fff);border-radius:8px;padding:17px;box-shadow:0 8px 22px #8e3b4810}',
     '.leak-card{border:1px solid var(--state-fermee-border);background:var(--surface-card);border-radius:8px;padding:17px;box-shadow:var(--shadow-sm)}'),
    ('.leak-card-top{display:flex;align-items:center;gap:7px;color:#d64e57;font-size:8px;font-weight:800;letter-spacing:1px}',
     '.leak-card-top{display:flex;align-items:center;gap:7px;color:var(--state-fermee-accent);font-size:8px;font-weight:800;letter-spacing:1px}'),
    ('.severity-dot{width:7px;height:7px;background:#e34d5b;border-radius:50%;box-shadow:0 0 0 4px #e34d5b22}',
     '.severity-dot{width:7px;height:7px;background:var(--state-fermee-dot);border-radius:50%;box-shadow:0 0 0 4px var(--state-fermee-glow)}'),
    ('.leak-confidence{margin-left:auto;color:#159b76;background:#e8f8f2;padding:4px 6px;border-radius:4px;font-size:7px;font-weight:700}',
     '.leak-confidence{margin-left:auto;color:var(--state-normal-badge-text);background:var(--state-normal-badge-bg);padding:4px 6px;border-radius:4px;font-size:7px;font-weight:700}'),
    ('.leak-coordinate{padding:21px 0 15px;border-bottom:1px solid #f1e7e6}',
     '.leak-coordinate{padding:21px 0 15px;border-bottom:1px solid var(--border-subtle)}'),
    ('.leak-coordinate small,.leak-facts small{display:block;color:#a78c8d;font-size:8px;letter-spacing:1px}',
     '.leak-coordinate small,.leak-facts small{display:block;color:var(--text-muted);font-size:8px;letter-spacing:1px}'),
    ('.leak-coordinate strong{display:block;color:#253c50;font:700 15px Manrope;margin:6px 0}',
     '.leak-coordinate strong{display:block;color:var(--text-heading);font:700 15px Manrope;margin:6px 0}'),
    ('.leak-coordinate span{font-size:9px;color:#9b8c91}',
     '.leak-coordinate span{font-size:9px;color:var(--text-muted)}'),
    ('.leak-facts b{display:block;color:#253c50;font:700 13px Manrope;margin-top:5px}',
     '.leak-facts b{display:block;color:var(--text-heading);font:700 13px Manrope;margin-top:5px}'),
    ('.leak-facts em{font:500 8px \"DM Sans\";color:#9b8c91}',
     '.leak-facts em{font:500 8px \"DM Sans\";color:var(--text-muted)}'),
    ('.sensor-card{border-color:#dbeee9;background:#fbfffd}',
     '.sensor-card{border-color:var(--state-normal-border);background:var(--surface-card)}'),
    ('.sensor-card .severity-dot{background:#19aa86;box-shadow:0 0 0 4px #19aa8620}',
     '.sensor-card .severity-dot{background:var(--state-normal-accent);box-shadow:0 0 0 4px var(--state-normal-glow)}'),
    ('.sensor-card .leak-card-top{color:#159b76}',
     '.sensor-card .leak-card-top{color:var(--state-normal-accent)}'),

    # Map Controls & Tools
    ('.map-tool{border:1px solid #dfe7ed;background:#fff;color:#61778a;border-radius:6px;padding:8px 10px;font-size:9px;font-weight:700}',
     '.map-tool{border:1px solid var(--btn-outline-border);background:var(--btn-outline-bg);color:var(--btn-outline-text);border-radius:6px;padding:8px 10px;font-size:9px;font-weight:700}'),
    ('.measure-status{display:inline-block;padding:4px 7px;border-radius:4px;background:#e8f8f2;color:#159b76;font-weight:700;letter-spacing:.3px}',
     '.measure-status{display:inline-block;padding:4px 7px;border-radius:4px;background:var(--state-normal-badge-bg);color:var(--state-normal-badge-text);font-weight:700;letter-spacing:.3px}'),
    ('.measure-status.danger{background:#fff0ef;color:#d9535b}',
     '.measure-status.danger{background:var(--state-fermee-badge-bg);color:var(--state-fermee-badge-text)}'),

    # Insights Strip
    ('.insight-strip{display:flex;align-items:center;gap:14px;background:linear-gradient(100deg,#eaf8fb,#f5fbfc);border:1px solid #d5edf2;border-radius:9px;padding:14px 17px;margin-bottom:15px}',
     '.insight-strip{display:flex;align-items:center;gap:14px;background:var(--surface-card-subtle);border:1px solid var(--border-interactive);border-radius:9px;padding:14px 17px;margin-bottom:15px}'),
    ('.insight-icon{width:31px;height:31px;border-radius:9px;background:#d5f1f5;color:#0b9ac0;display:grid;place-items:center;font-size:17px}',
     '.insight-icon{width:31px;height:31px;border-radius:9px;background:var(--brand-blue-subtle);color:var(--brand-blue);display:grid;place-items:center;font-size:17px}'),
    ('.insight-strip small{display:block;color:#1597b8;font-size:7px;font-weight:800;letter-spacing:1.1px}',
     '.insight-strip small{display:block;color:var(--brand-blue);font-size:7px;font-weight:800;letter-spacing:1.1px}'),
    ('.insight-strip b{display:block;color:#21445c;font-size:10px;margin:5px 0}',
     '.insight-strip b{display:block;color:var(--text-heading);font-size:10px;margin:5px 0}'),
    ('.insight-strip p{margin:0;color:#7c94a3;font-size:8px}',
     '.insight-strip p{margin:0;color:var(--text-muted);font-size:8px}'),
    ('.insight-score{text-align:center;color:#0b9ac0;font:800 19px Manrope}',
     '.insight-score{text-align:center;color:var(--brand-blue);font:800 19px Manrope}'),

    # Valve Visualizer
    ('.valve-ring{width:102px;height:102px;border:7px solid #d8f4eb;border-radius:50%;display:grid;place-items:center;z-index:2;background:#f2fbf7;box-shadow:0 0 0 8px #f4faf7}',
     '.valve-ring{width:102px;height:102px;border:7px solid var(--valve-ring-border);border-radius:50%;display:grid;place-items:center;z-index:2;background:var(--valve-ring-bg);box-shadow:0 0 0 8px var(--valve-ring-shadow)}'),
    ('.valve-core{width:67px;height:67px;border-radius:50%;background:linear-gradient(145deg,#39c99b,#0c966d);display:grid;place-items:center;color:#fff;font-size:29px;box-shadow:0 7px 18px #149e7733}',
     '.valve-core{width:67px;height:67px;border-radius:50%;background:linear-gradient(145deg,var(--valve-core-from),var(--valve-core-to));display:grid;place-items:center;color:#fff;font-size:29px;box-shadow:0 7px 18px var(--valve-core-shadow)}'),
    ('.closed .valve-ring{border-color:#ffe0df;background:#fff5f4}',
     '.closed .valve-ring{border-color:var(--valve-closed-ring-border);background:var(--valve-closed-ring-bg)}'),
    ('.closed .valve-core{background:linear-gradient(145deg,#f17b7e,#d74750)}',
     '.closed .valve-core{background:linear-gradient(145deg,var(--valve-closed-core-from),var(--valve-closed-core-to))}'),
    ('.pipe{position:absolute;height:14px;width:34%;background:linear-gradient(#b4d7e5,#e4f1f6,#a8cedd);top:calc(50% - 7px)}',
     '.pipe{position:absolute;height:14px;width:34%;background:linear-gradient(var(--border-interactive),var(--surface-card-subtle),var(--border-default));top:calc(50% - 7px)}'),
    ('.valve-state small{display:block;font-size:8px;color:#9aa7b2;letter-spacing:1.2px}',
     '.valve-state small{display:block;font-size:8px;color:var(--text-muted);letter-spacing:1.2px}'),
    ('.valve-state b{display:block;font:700 14px Manrope;color:#159b76;margin:5px}',
     '.valve-state b{display:block;font:700 14px Manrope;color:var(--state-normal-accent);margin:5px}'),
    ('.valve-state span{font-size:9px;color:#8999a7}',
     '.valve-state span{font-size:9px;color:var(--text-secondary)}'),
    ('.manual-note{text-align:center;font-size:8px;color:#a3afb9;margin:12px 0 0}',
     '.manual-note{text-align:center;font-size:8px;color:var(--text-muted);margin:12px 0 0}'),
]

for old, new in replacements:
    if old not in text:
        print(f"Warning: pattern not found in deep refactor: {old[:40]}")
    text = text.replace(old, new)

with open('assets/style.css', 'w', encoding='utf-8') as f:
    f.write(text)

print('Deep refactor of style.css done!')
