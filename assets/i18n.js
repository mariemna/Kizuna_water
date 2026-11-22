(function () {
  'use strict';

  const STORAGE_KEY = 'kizuna_language';

  const translations = {
    jp: {
      'AI_BADGE': '知',
      'From data to action.': 'データから迅速な対応へ。',
      'A network that speaks.': '語りかけるスマートネットワーク',

      "English": "英語",
      "Time": "時刻",
      "Status": "状態",
      "Analysis": "分析",
      "Normal": "正常",
      "Threshold exceeded": "しきい値超過",
      "A network that ": "語りかける",
      "A network that": "語りかける",
      "speaks.": "スマートネットワーク。",
      "From data": "データから",
      "to ": "迅速な",
      "to": "迅速な",
      "action.": "対応へ。",
      "✓ Prevent invisible losses": "✓ 目に見えない損失を防止",
      "✓ Respond faster to anomalies": "✓ 異常へより迅速に対応",
      "✓ Encourage responsible water management": "✓ 責任ある水管理を推進",
      "SMART WATER · SMART CITY · SMART FUTURE": "スマートウォーター · スマートシティ · スマートフューチャー",
      "HydroMind · Real-time Monitoring": "HydroMind · リアルタイム監視",
      "Real-time data · Real-time Monitoring": "リアルタイムデータ · リアルタイム監視",
      "HydroMind — Smart Water Management System · Real-time Monitoring": "HydroMind — スマート給水管理システム · リアルタイム監視",
      "HydroMind · Hackathon KIZUNA 2026": "HydroMind · ハッカソン KIZUNA 2026",
      "Real-time data · MySQL · Hackathon KIZUNA 2026": "リアルタイムデータ · MySQL · ハッカソン KIZUNA 2026",
      "HydroMind — Smart Water Management System · Hackathon KIZUNA 2026": "HydroMind — スマート給水管理システム · ハッカソン KIZUNA 2026",
      "LIVE": "リアルタイム",
      "Leak confirmed ({type})": "漏水確認（{type}）",
      "Anomaly detected ({type})": "異常検知（{type}）",
      "Safety closure triggered · {flow} L/min": "安全閉鎖を実行 · {flow} L/min",
      "Flow: {flow} L/min · Monitoring active": "流量：{flow} L/min · 監視中",
      "Interactive map of the Tunisian network": "チュニジアネットワークのインタラクティブ地図",
      "Zoom in": "拡大",
      "Zoom out": "縮小",
      "Close popup": "ポップアップを閉じる",
      "A JavaScript library for interactive maps": "インタラクティブ地図ライブラリ",
      "contributors ©": "提供者 ©",
      "CARTO": "CARTO",
      "View account & alerts": "アカウントとアラートを見る",
      "My account & alerts": "マイアカウント＆アラート",
      "Alerts": "アラート",
      "Alertes": "アラート",
      "ex: technicien@kizuna.tn": "例：technicien@kizuna.tn",
      "ex: Yassine Trabelsi": "例：Yassine Trabelsi",
      "ex: 123456789": "例：123456789",
      "Flow ≥ 8.0 L/min for 3 consecutive readings": "流量 ≥ 8.0 L/min が 3 回連続",
      "Flow > 0.50 L/min sustained in night window": "夜間帯において流量 > 0.50 L/min が継続",
      "Flow in ]2.5, 5.0[ L/min sustained for 5 readings": "流量 ]2.5, 5.0[ L/min が 5 回連続継続",
      "Telegram Chat ID (optional)": "Telegramチャット番号（任意）",
      "Telegram Chat ID": "Telegramチャット番号",
      "Chat ID:": "チャット番号：",
      "チャット番号：": "チャット番号：",
      "Please enter your Telegram Chat ID to enable Telegram alerts.": "Telegramアラートを有効にするにはTelegramチャット番号を入力してください。",
      "Enable or disable SMS and Telegram to demonstrate how each format adapts: plain-text SMS with a full address, or Telegram with a direct Google Maps link.": "SMSとTelegramを切り替えて、完全な住所を含むプレーンテキストSMSと、地図直接リンク付きTelegramの違いをデモできます。",
      "Instant notification with a direct Google Maps button for the impact location.": "漏水箇所への直接地図ボタンが付いた即時通知。",
      "Instant rich notification with a direct Google Maps link to the exact leak location.": "正確な漏水地点への地図直接リンクを含むリッチ即時通知。",
      "Plain-text message without a URL, optimized for standard mobile phones. Includes the full address and GPS coordinates.": "標準的な携帯電話向けに最適化されたリンクなしのプレーンテキストメッセージ。完全な住所とGPS座標を含みます。",
      "Printable A4 intervention report with KPIs, chart, rules & signature": "主要指標、グラフ、検知ルール、署名欄を含む印刷用A4対応報告書",
      "AI detection": "人工知能検知",
      "AI": "人工知能",
      "Explore the AI ↗": "人工知能を詳しく見る ↗",
      "HydroMind monitors water networks, detects abnormal consumption with artificial intelligence, and acts before a small loss becomes a major problem.": "HydroMindは給水ネットワークを監視し、人工知能で異常な使用量を検知して、わずかな損失が重大な問題に発展する前に迅速に対処します。",
      // ── GLOSSARY EXACT MATCHES ──
      'trend': '傾向',
      'Trend': '傾向',
      'TREND': '傾向',
      'prediction': '予測',
      'Prediction': '予測',
      'PREDICTION': '予測',
      'Trend watch': '傾向監視',
      'Trend watch:': '傾向監視：',
      'Leak prediction': '漏水予測',
      'Leak Prediction': '漏水予測',
      'Inspection recommended.': '点検を推奨します。',
      'alert threshold': 'しきい値',
      'night leak limit': '夜間漏水制限値',
      'leak': '漏水',
      'Leak': '漏水',
      'LEAK': '漏水',
      'flow': '流量',
      'Flow': '流量',
      'FLOW': '流量',
      'valve': 'バルブ',
      'Valve': 'バルブ',
      'VALVE': 'バルブ',
      'open': '開',
      'Open': '開',
      'OPEN': '開',
      'closed': '閉',
      'Closed': '閉',
      'CLOSED': '閉',
      'alert': 'アラート',
      'Alert': 'アラート',
      'ALERT': 'アラート',
      'alerts': 'アラート',
      'Alerts': 'アラート',
      'anomaly': '異常',
      'Anomaly': '異常',
      'ANOMALY': '異常',
      'threshold': 'しきい値',
      'Threshold': 'しきい値',
      'Pipe burst': '管路破裂',
      'Night leak (Minimum Night Flow)': '夜間漏水（夜間最小流量）',
      'Micro-leak (slow seepage)': '微小漏水（緩やかな滲出）',
      'Sudden flow spike': '急激な流量変化',
      'Flow above threshold': 'しきい値超過',
      'water saved': '節水量',
      'Water saved': '節水量',
      'Water Saved': '節水量',
      'WATER SAVED': '節水量',
      'consumption': '使用量',
      'Consumption': '使用量',
      'technician': '技術者',
      'Technician': '技術者',
      'sector': 'セクター',
      'Sector': 'セクター',
      'report': '報告書',
      'Report': '報告書',
      'intervention': '対応',
      'Intervention': '対応',
      'export': 'エクスポート',
      'Export': 'エクスポート',
      'Light': 'ライト',
      'Dark': 'ダーク',
      'Comfort': '目にやさしい',
      'Back to normal': '正常復帰',
      'Simulated': 'シミュレーション',
      'SIMULATED': 'シミュレーション',
      'Sent': '送信済み',
      'SENT': '送信済み',
      'Failed': '送信失敗',
      'FAILED': '送信失敗',
      'Live': 'リアルタイム',
      'Paused': '一時停止中',
      'Resume': '再開',

      // ── FLOW CONTROL GLOSSARY & STRINGS ──
      'flow control': '流量制御',
      'Flow control': '流量制御',
      'Flow Control': '流量制御',
      'FLOW CONTROL': '流量制御',
      'valve opening': '開度',
      'Valve opening': '開度',
      'Valve Opening': '開度',
      'VALVE OPENING': 'バルブ開度',
      'Valve opening:': 'バルブ開度：',
      'Night eco': '夜間節水',
      'NIGHT ECO': '夜間節水',
      'ECO_NUIT': '夜間節水',
      'Event mode': 'イベントモード',
      'EVENT MODE': 'イベントモード',
      'EVENEMENT': 'イベントモード',
      'Manual': '手動',
      'MANUAL': '手動',
      'Auto': '自動',
      'AUTO': '自動',
      'Demand': '需要流量',
      'DEMAND': '需要流量',
      'Delivered': '供給流量',
      'DELIVERED': '供給流量',
      'Delivered flow': '供給流量',
      'Demand (L/min)': '需要流量（L/min）',
      'Opening (%)': '開度（%）',
      'Operating Regime': '運転モード',
      'OPERATING REGIME': '運転モード',
      'Manual Opening': '手動開度',
      'MANUAL OPENING': '手動開度',
      'Duration (hours):': '継続時間（時間）：',
      'Duration (hours)': '継続時間（時間）',
      'Event duration:': 'イベント継続時間：',
      'Apply': '適用',
      'APPLY': '適用',
      'Throttled': '流量絞り',
      'Event active': 'イベントモード作動中',
      'Proportional valve regulation · Demand management': '比例バルブ制御 · 需要管理',
      '⚡ Delivered = Demand × Opening %': '⚡ 供給流量 ＝ 需要流量 × 開度%',
      'Valve {pct}% open ({regime})': 'バルブ開度 {pct}%（{regime}）',
      'Valve opening: {pct}%': 'バルブ開度：{pct}%',
      'Demand {demand} → Delivered {delivered} L/min': '需要流量 {demand} → 供給流量 {delivered} L/min',
      'Throttled {pct}% – {avoided} L/min saved': '流量絞り {pct}% — 節水量 {avoided} L/min',
      'Throttled {pct}%': '流量絞り {pct}%',
      'Event until {time}': 'イベント終了予定：{time}',
      'Active until {time}': '{time} まで作動中',
      'Regime changed: {regime}': '運転モードを変更：{regime}',
      'Operating regime updated': '運転モードを更新しました',
      'Manual opening set to {pct}%': '手動開度を {pct}% に設定',
      'Manual valve opening applied': 'バルブ手動開度を適用しました',
      'Valve opening reset to Auto': 'バルブ開度を自動に復元',
      'Automatic regime control restored': '自動制御モードを復帰しました',
      'Valve 100% open (Normal)': 'バルブ開度 100%（通常）',
      'last known': '最終計測値',
      'Last known': '最終計測値',
      '(last known)': '（最終計測値）',
      '● last known': '● 最終計測値',
      'Sensor online': 'センサーオンライン',
      'Sensor offline': 'センサーオフライン',
      'OFFLINE': 'オフライン',
      'STANDBY': '待機中',

      // ── THEME SWITCHER ──
      'Theme switcher': 'テーマ切替',
      'Light theme': 'ライトテーマ',
      'Dark theme': 'ダークテーマ',
      'Eye comfort theme': '目にやさしいテーマ',
      '☀️ Light': '☀️ ライト',
      '🌙 Dark': '🌙 ダーク',
      '👁️ Comfort': '👁️ 目にやさしい',

      // ── LANGUAGE SWITCHER ──
      'Language selection': '言語選択',
      'English': '英語',
      '日本語': '日本語',

      // ── PAGE TITLES ──
      'HydroMind — Every Drop Matters': 'HydroMind — 一滴の水が大切です',
      'Technician Portal — HydroMind': '技術者ポータル — HydroMind',
      'Dashboard — HydroMind': 'ダッシュボード — HydroMind',
      'Intervention Report — HydroMind': '対応報告書 — HydroMind',

      // ── PUBLIC SITE (index.html) ──
      'Live Overview': 'ライブ概要',
      'Our Solution': '私たちのソリューション',
      'How It Works': '仕組み',
      'Our Impact': '導入効果',
      'About Us': '私たちについて',
      'Open Dashboard': 'ダッシュボードを開く',
      'Open Dashboard ↗': 'ダッシュボードを開く ↗',
      'SMART WATER FOR CITIES OF TOMORROW': '未来の都市のためのスマートウォーター',
      'Every drop matters.': '一滴の水が大切です。',
      'Every leak is detected.': 'すべての漏水を検知します。',
      'Every drop': '一滴の水が',
      'matters.': '大切です。',
      'Every leak': 'すべての漏水を',
      'is detected.': '検知します。',
      'HydroMind monitors water networks, detects abnormal consumption with artificial intelligence, and acts before a small loss becomes a major problem.': 'HydroMindは給水ネットワークを監視し、人工知能で異常な使用量を検知して、わずかな損失が重大な問題に発展する前に迅速に対処します。',
      'Explore the Dashboard': 'ダッシュボードを見る',
      'Explore the Dashboard <span>→</span>': 'ダッシュボードを見る <span>→</span>',
      'Discover the Technology': '技術を詳しく見る',
      'Discover the Technology <span>↓</span>': '技術を詳しく見る <span>↓</span>',
      'A technology built for': '持続可能な未来のために',
      'a more sustainable future': '構築されたテクノロジー',
      'MONITORING': '監視',
      'Real-time': 'リアルタイム',
      'NETWORK PROTECTION': 'ネットワーク保護',
      'Smart analytics': 'スマート分析',
      'OUR MISSION': '私たちの使命',
      'Protect every drop': 'すべての水滴を守る',
      '01 — 04': '01 — 04',
      'PROTECTING WATER MEANS PROTECTING LIFE': '水を守ることは、生命を守ることです',
      'AN INTELLIGENT APPROACH': 'スマートなアプローチ',
      'Continuous monitoring': '継続的な監視',
      'AI detection': '人工知能検知',
      'Automatic action': '自動対応',
      'Long-term impact': '長期的な効果',
      'LIVE OVERVIEW': 'ライブ概要',
      'A network that speaks.': '語りかけるスマートネットワーク',
      'A network that <em>speaks.</em>': '語りかけるスマートネットワーク',
      'Open Control Center': 'コントロールセンターを開く',
      'Open Control Center <span>↗</span>': 'コントロールセンターを開く <span>↗</span>',
      'LIVE MONITORING': 'ライブ監視',
      'Now': '現在',
      'Flow is continuously analyzed to reveal invisible variations.': '目に見えない流量の微小な変化を捉えるため、流量を継続的に分析しています。',
      'Volume preserved through early alerts.': '早期アラートによって保全された水量です。',
      'PROTECTIVE ACTIONS': '保護対応',
      'Automatic emergency closures triggered today.': '本日実行された自動緊急遮断の回数です。',
      'View Analysis': '分析を見る',
      'View Analysis ↗': '分析を見る ↗',
      '01 / OUR SOLUTION': '01 / 私たちのソリューション',
      'A smarter network.': 'よりスマートなネットワーク',
      'A future without waste.': '無駄のない未来',
      'A smarter network.<br><em>A future without waste.</em>': 'よりスマートなネットワーク。<br><em>無駄のない未来。</em>',
      'Hidden leaks can waste significant volumes of water. Our platform turns consumption data into immediate, actionable decisions.': '見えない漏水は膨大な水資源を浪費します。私たちのプラットフォームは、使用量データを即時の対応へと変換します。',
      '01 — MONITORING': '01 — 監視',
      'Continuous Monitoring': '継続的な監視',
      'Track water flow in real time and identify unusual network behavior.': '給水流量をリアルタイムで追跡し、ネットワークの異常な動作を特定します。',
      'View Monitoring ↗': '監視を見る ↗',
      '02 — INTELLIGENCE': '02 — インテリジェンス',
      'Smart Detection': 'スマート検知',
      'Consumption analysis, especially at night, helps identify anomalies instantly.': '特に夜間の使用量分析により、異常を瞬時に特定します。',
      'Explore the AI ↗': '人工知能を詳しく見る ↗',
      '03 — AUTOMATION': '03 — 自動化',
      'Immediate Action': '即時対応',
      'Once a leak is confirmed, the motorized valve can close automatically.': '漏水が確認されると、バルブが自動的に閉鎖されます。',
      'Once a leak is confirmed, the virtual valve can close automatically.': '漏水が確認されると、バルブが自動的に閉鎖されます。',
      'View Controls ↗': '制御を見る ↗',
      '02 / HOW IT WORKS': '02 / 仕組み',
      'From data': 'データから',
      'to action.': '迅速な対応へ',
      'From data<br>to <em>action.</em>': 'データから<br><em>迅速な対応へ。</em>',
      'An intelligent chain that turns every signal into protection.': 'あらゆる兆候を保護へと変えるインテリジェントな連携。',
      'Measure': '計測',
      'The sensor records water flow continuously.': 'センサーが給水流量を継続的に記録します。',
      'The virtual sensor records water flow continuously.': 'センサーが給水流量を継続的に記録します。',
      'Analyze': '分析',
      'The algorithm compares readings with expected behavior.': 'アルゴリズムが計測値と期待される基準値を比較します。',
      'Detect': '検知',
      'Abnormal consumption immediately triggers an alert.': '異常な使用量を検知すると、即座にアラートを発信します。',
      'Protect': '保護',
      'The motorized valve closes to minimize water loss.': 'バルブが閉鎖され、漏水被害を最小限に抑えます。',
      'The virtual valve closes to minimize water loss.': 'バルブが閉鎖され、漏水被害を最小限に抑えます。',
      'ONE PLANET. ONE RESOURCE.': 'ひとつの地球。限られた資源。',
      '03 / OUR COMMITMENT': '03 / 私たちの約束',
      'Technology serving': '活用するテクノロジー',
      'what matters most.': '最も大切なことのために',
      'Technology serving<br><em>what matters most.</em>': '活用するテクノロジー<br><em>最も大切なことのために。</em>',
      'In a context of growing water stress, protecting water resources is a shared responsibility. HydroMind combines innovation, prevention, and efficiency.': '水ストレスが高まる現代において、水資源の保全は共通の責務です。HydroMindは革新、予防、効率を融合します。',
      'Prevent invisible losses': '目に見えない損失を防止',
      'Respond faster to anomalies': '異常へより迅速に対応',
      'Encourage responsible water management': '責任ある水管理を推進',
      'Discover the Platform': 'プラットフォームを見る',
      'Discover the Platform →': 'プラットフォームを見る →',
      'Together, let\'s make every drop': 'ともに、すべての水滴を',
      'a protected resource.': '守られた資源へ。',
      'Together, let\'s make every drop<br>a protected resource.': 'ともに、すべての水滴を<br>守られた資源へ。',
      'Open Control Center ↗': 'コントロールセンターを開く ↗',
      'Launch the Demonstration': 'デモンストレーションを開始',
      'Launch the Demonstration ↗': 'デモンストレーションを開始 ↗',
      'Administration Center': '管理センター',
      'Administration Center ↗': '管理センター ↗',
      '© 2026 HydroMind · Every drop matters.': '© 2026 HydroMind · 一滴の水が大切です。',
      'SMART WATER MANAGEMENT SYSTEM': 'スマート給水管理システム',
      'Open menu': 'メニューを開く',

      // ── AUTH (auth.html) ──
      'Technician Portal': '技術者ポータル',
      'View Dashboard': 'ダッシュボードを見る',
      'View Dashboard ↗': 'ダッシュボードを見る ↗',
      'Sign In': 'ログイン',
      'New Technician': '新規技術者',
      'Create Account': 'アカウント作成',
      'Access the control center and receive intervention alerts.': 'コントロールセンターにアクセスし、対応アラートを受信します。',
      'Register a maintenance technician and configure alert channels.': '保守技術者を登録し、アラート通知チャネルを設定します。',
      'Fill Technician Credentials': '技術者アカウントを入力',
      '⚡ Fill Technician Credentials': '⚡ 技術者アカウントを入力',
      'Fill with Demo Account': 'デモアカウントを入力',
      '⚡ Fill with Demo Account': '⚡ デモアカウントを入力',
      'Work Email': '業務用メール',
      'Password': 'パスワード',
      'Sign in to Monitoring': '監視画面にログイン',
      'Sign in to Monitoring →': '監視画面にログイン →',
      'Technician Full Name': '技術者氏名',
      'Email': 'メールアドレス',
      'Phone (SMS)': '電話番号（SMS）',
      'Telegram Chat ID (optional)': 'Telegramチャット番号（任意）',
      'Assigned Sector': '担当セクター',
      'Password (minimum 6 characters)': 'パスワード（6文字以上）',
      'Alert Notification Channels': 'アラート通知チャネル',
      'Emergency SMS Alerts': '緊急SMSアラート',
      '📱 Emergency SMS Alerts': '📱 緊急SMSアラート',
      'Plain-text message with no link, including the full address and GPS coordinates.': '完全な住所とGPS座標を含む、リンクなしのプレーンテキストメッセージ。',
      'Telegram Bot Alerts': 'Telegramボットアラート',
      '✈️ Telegram Bot Alerts': '✈️ Telegramボットアラート',
      'Instant notification with a direct Google Maps button for the impact location.': '漏水箇所への直接直接地図ボタンが付いた即時通知。',
      'Create Technician Profile': '技術者プロフィールを作成',
      'Create Technician Profile →': '技術者プロフィールを作成 →',
      'Back to Public Website': '公開サイトに戻る',
      '← Back to Public Website': '← 公開サイトに戻る',
      'Open Dashboard Directly': 'ダッシュボードを直接開く',
      'Open Dashboard Directly →': 'ダッシュボードを直接開く →',
      'Technician credentials ready: technicien@kizuna.tn / Kizuna2026!': '技術者アカウント入力完了：technicien@kizuna.tn / Kizuna2026!',
      'Demo account ready: technicien@kizuna.tn / Kizuna2026!': 'デモアカウント入力完了：technicien@kizuna.tn / Kizuna2026!',
      'Verifying…': '確認中…',
      'Sign-in successful! Redirecting to the dashboard…': 'ログインしました。ダッシュボードに移動します…',
      'Creating account…': 'アカウント作成中…',
      'Account created successfully! Redirecting to the dashboard…': 'アカウントを作成しました。ダッシュボードに移動します…',
      'Invalid credentials': '認証情報が無効です',
      'Account creation failed': 'アカウント作成に失敗しました',

      // ── DASHBOARD (dashboard.html) ──
      'MAIN MENU': 'メインメニュー',
      'Overview': '概要',
      'Live Monitoring': 'ライブ監視',
      'Valve Control': 'バルブ制御',
      'History': '履歴',
      'SETTINGS': '設定',
      'SYSTEM': 'システム',
      'Settings': '設定',
      'My Account': 'マイアカウント',
      'Public Website': '公開サイト',
      'System operational': 'システム稼働中',
      'Live telemetry': 'リアルタイム・テレメトリ',
      'MySQL · Real-time': 'MySQL · リアルタイム',
      'Network supervision': 'ネットワーク監視',
      'ESPRIT Technician': 'ESPRIT技術者',
      'Voir mon compte et mes alertes': 'アカウントとアラートを見る',
      'Mon compte & alertes': 'マイアカウント＆アラート',
      'Hello, Technician': 'こんにちは、技術者',
      'Here is your water network status today.': '本日の給水ネットワーク状況です。',
      'Today': '今日',
      'REAL-TIME DATA': 'リアルタイムデータ',
      'Refreshing every 2 s': '2秒ごとに更新',
      'Reset': 'リセット',
      '↻ Reset': '↻ リセット',
      'No anomaly detected': '異常は検出されませんでした',
      'Flow is within the normal range.': '流量は正常範囲です。',
      'JUST NOW': 'たった今',
      'View Alert': 'アラートを見る',
      'View Alert ↗': 'アラートを見る ↗',
      'Current Flow': '現在の流量',
      'Today\'s Consumption': '本日の使用量',
      'Alerts Detected': '検出されたアラート',
      'Valve Status': 'バルブ状態',
      'Liters': 'リットル',
      'Live measurement': 'ライブ計測',
      '● Live measurement': '● ライブ計測',
      'Cumulative data': '累積データ',
      '↗ Cumulative data': '↗ 累積データ',
      'Monitoring required': '監視が必要です',
      '● Monitoring required': '● 監視が必要です',
      'Normal operation': '正常稼働',
      '● Normal operation': '● 正常稼働',
      'Flow interrupted': '流量停止',
      '● Flow interrupted': '● 流量停止',
      'Estimated water saved through leak protection': '漏水保護による推定節水量',
      'Emergency shutoff active': '緊急遮断作動中',
      '● Emergency shutoff active': '● 緊急遮断作動中',
      'Anomaly under surveillance': '異常監視中',
      '● Anomaly under surveillance': '● 異常監視中',
      'Monitoring active · Normal': '監視中 · 正常',
      '● Monitoring active · Normal': '● 監視中 · 正常',

      // ── MAP PANEL ──
      'NATIONAL NETWORK · TUNISIA': '全国ネットワーク・チュニジア',
      'Locate the Leak': '漏水箇所を特定',
      'Tunisian network · ESPRIT Sector A connected · GPS precision': 'チュニジアネットワーク · ESPRITセクターA接続 · GPS精度',
      'SYNCHRONIZED': '同期済み',
      '● SYNCHRONIZED': '● 同期済み',
      'Center Leak': '漏水箇所を中央表示',
      '◎ Center Leak': '◎ 漏水箇所を中央表示',
      'Active sensor': '稼働センサー',
      'ACTIVE SENSOR': '稼働センサー',
      'Leak located': '漏水特定地点',
      'IMPACT POINT': '検出地点',
      'MEASURED FLOW': '計測流量',
      'SOURCE': 'データソース',
      'STATUS': '状態',
      'STATUS / LIVE': '状態 / リアルタイム',
      'MySQL LIVE': 'MySQL リアルタイム',
      'Simulated sensor': 'シミュレーションセンサー',
      'View Exact Location': '正確な場所を見る',
      'View Exact Location ↗': '正確な場所を見る ↗',
      'Mark as Resolved': '対応済みにする',
      'Click a sensor to explore the network.': 'センサーを選択してネットワークを確認できます。',
      'PROCESSING': '対応中',
      'TRAITEMENT EN COURS': '対応中',
      'NORMAL OPERATION': '正常稼働',
      'LEAK CONFIRMED': '漏水確認',
      'ANOMALY DETECTED': '異常検知',
      'Normal · LIVE': '正常 · リアルタイム',
      'Simulated — Normal': 'シミュレーション — 正常',
      'Leak acknowledged': '漏水対応開始',
      'Intervention underway in Sector A': 'セクターAで対応中',

      // ── MONITORING / CHARTS / VALVE ──
      'Flow Monitoring': '流量監視',
      'Water flow evolution in real time': 'リアルタイムの給水流量推移',
      'Measured flow': '計測流量',
      'Measured Flow': '計測流量',
      'Measured Flow (L/min)': '計測流量 (L/min)',
      'Alert threshold': 'しきい値',
      'Alert Threshold': 'しきい値',
      '60 seconds ago': '60秒前',
      'Smart motorized actuator': 'スマート電動アクチュエータ',
      'Smart actuator · Virtual ESP32': 'スマートアクチュエータ · 仮想ESP32',
      'CURRENT STATUS': '現在の状態',
      'Waiting for data…': 'データ待機中…',
      'Close Valve': 'バルブを閉じる',
      'Open Valve': 'バルブを開く',
      'Night Mode: OFF': 'ナイトモード：オフ',
      'Night Mode: ON': 'ナイトモード：オン',
      '☀️ Night Mode: OFF': '☀️ ナイトモード：オフ',
      '🌙 Night Mode: ON': '🌙 ナイトモード：オン',
      'Connected to MySQL · Real-time data': 'MySQL接続 · リアルタイムデータ',
      '⚠ Connected to MySQL · Real-time data': '⚠ MySQL接続 · リアルタイムデータ',
      'Valve open': 'バルブ開',
      'Valve closed': 'バルブ閉',
      'Valve opened': 'バルブを開きました',
      'Valve closed automatically': 'バルブを自動閉鎖しました',
      'Valve reopened': 'バルブ再開',
      'Anti-leak protection activated': '漏水防止保護を作動',
      'Normal network operation restored': '通常稼働に復帰',
      'Manual command executed': '手動操作を実行',
      'Flow interrupted by operator': '操作員によって流量を停止',
      'Night mode enabled': 'ナイトモード有効',
      'Night mode disabled': 'ナイトモード無効',
      'Leak threshold lowered to 1.0 L/min': '漏水しきい値を1.0 L/minに引き下げ',
      'Normal threshold restored (5.0 L/min)': '通常しきい値（5.0 L/min）に復帰',
      'Water is flowing normally through the network.': '給水ネットワークで水が正常に流れています。',
      'Water circulation is currently interrupted.': '現在、水の循環が停止しています。',
      'Water is flowing under surveillance.': '監視下で送水しています。',
      'Leak confirmed – valve closed automatically': '漏水確認 — バルブ自動閉鎖',
      'Anomaly detected – valve open, monitoring': '異常検知 — バルブ開・監視中',
      'Water network closed automatically.': '給水ネットワークを自動閉鎖しました。',
      'Online': 'オンライン',

      // ── RECENT ALERTS & ACTIVITY ──
      'Recent Alerts': '最新のアラート',
      'Events detected by the system': 'システムで検出されたイベント',
      'View All': 'すべて表示',
      'View All ↗': 'すべて表示 ↗',
      'Monitoring active': '監視中',
      'Sensors are successfully transmitting measurements': 'センサーが正常に計測値を送信しています',
      'Today · Continuous': '今日 · 継続中',
      'Today · Active': '今日 · 発生中',
      'INFO': '情報',
      'WARNING': '警告',
      'CRITICAL': '緊急',
      'RESOLVED': '解決済み',
      'Activity Log': 'アクティビティログ',
      'Latest actions from the system': 'システムの最新操作',
      'System started': 'システム起動',
      'Live telemetry · now': 'テレメトリ接続済み · 現在',
      'Connected · now': '接続済み · 現在',
      'MySQL connected · now': 'MySQL接続済み · 現在',
      'Network normalized': 'ネットワーク正常化',
      'Flow returned below the alert threshold': '流量がしきい値未満に戻りました',

      // ── MEASUREMENT HISTORY ──
      'Measurement History': '計測履歴',
      'Latest readings recorded in real time': 'リアルタイムで記録された最新データ',
      '0 measurements': '0件の計測データ',
      'Waiting for measurements…': '計測データ待機中…',
      'Normal consumption': '通常使用量',

      // ── SETTINGS ──
      'Account & Technician Alert Settings': 'アカウントと技術者アラート設定',
      '⚙️ Account & Technician Alert Settings': '⚙️ アカウントと技術者アラート設定',
      'Manage your intervention details and emergency notification preferences': '対応情報と緊急通知設定を管理します',
      'Switch Account': 'アカウント切替',
      'Sign Out': 'ログアウト',
      'GUEST': 'ゲスト',
      'Full Name': '氏名',
      'Assigned Intervention Sector': '担当対応セクター',
      'Hackathon Demo Tip': 'ハッカソンデモのヒント',
      '💡 Hackathon Demo Tip': '💡 ハッカソンデモのヒント',
      'Enable or disable SMS and Telegram to demonstrate how each format adapts: plain-text SMS with a full address, or Telegram with a direct Google Maps link.': 'SMSとTelegramを切り替えて、完全な住所を含むプレーンテキストSMSと、直接地図リンク付きTelegramの違いをデモできます。',
      'Emergency Notification Preferences': '緊急通知設定',
      'Receive SMS Alerts': 'SMSアラートを受信',
      '📱 Receive SMS Alerts': '📱 SMSアラートを受信',
      'PLAIN TEXT · NO LINK': 'プレーンテキスト · リンクなし',
      'Plain Text · No Link': 'プレーンテキスト · リンクなし',
      'Plain-text message without a URL, optimized for standard mobile phones. Includes the full address and GPS coordinates.': '標準的な携帯電話向けに最適化されたリンクなしのプレーンテキストメッセージ。完全な住所とGPS座標を含みます。',
      'Mobile Number:': '携帯電話番号：',
      'Receive Telegram Alerts': 'Telegramアラートを受信',
      '✈️ Receive Telegram Alerts': '✈️ Telegramアラートを受信',
      'GPS MAPS LINK': 'GPS地図リンク',
      'GPS Maps Link': 'GPS地図リンク',
      'Instant rich notification with a direct Google Maps link to the exact leak location.': '正確な漏水地点への直接地図リンクを含むリッチ即時通知。',
      'Chat ID:': 'チャット番号：',
      'Save Preferences': '設定を保存',
      '💾 Save Preferences': '💾 設定を保存',
      'Test Alert': 'アラートテスト',
      '⚡ Test Alert': '⚡ アラートテスト',
      'Trigger an immediate test alert': '即時テストアラートを実行',
      'Preferences saved': '設定を保存しました',
      'Test alert triggered': 'テストアラートを実行',
      'Saving…': '保存中…',
      'Sending…': '送信中…',
      'Please enter a phone number to enable SMS alerts.': 'SMSアラートを有効にするには電話番号を入力してください。',
      'Please enter your Telegram Chat ID to enable Telegram alerts.': 'Telegramアラートを有効にするにはチャットIDを入力してください。',

      // ── FOOTER ──
      '© 2026 HydroMind · Smart Water Management System': '© 2026 HydroMind · スマート給水管理システム',
      'HydroMind · Real-time Monitoring': 'HydroMind · リアルタイム監視',
      'Real-time data · Real-time Monitoring': 'リアルタイムデータ · リアルタイム監視',
      'Real-time data · MySQL · Hackathon KIZUNA 2026': 'リアルタイムデータ · MySQL · ハッカソン KIZUNA 2026',

      // ── EXPORT MODAL ──
      'Export Data & Reports': 'データ・報告書のエクスポート',
      'Download records or generate official intervention reports': '記録データのダウンロードまたは公式対応報告書を生成します',
      'Close modal': 'モーダルを閉じる',
      'Period': '期間',
      'Last 24 h': '過去24時間',
      'Last 7 days': '過去7日間',
      'Custom': 'カスタム',
      'From': '開始日',
      'To': '終了日',
      'Format': 'フォーマット',
      'CSV – Measurements': 'CSV – 計測データ',
      'Raw flow readings (L/min), avoided flow, and valve state': '給水流量（L/min）、回避流量、バルブ状態の生データ',
      'CSV – Alerts': 'CSV – アラート',
      'Alert state transitions, leak types, and flow during incident': 'アラート状態遷移、漏水タイプ、インシデント発生時の流量',
      'CSV – Notifications': 'CSV – 通知ログ',
      'Emergency dispatch logs (SMS / Telegram) with masked numbers': 'マスクされた電話番号を含む緊急配信ログ（SMS / Telegram）',
      'PDF report (print)': 'PDF報告書（印刷用）',
      'Printable A4 intervention report with KPIs, chart, rules & signature': '主要指標、グラフ、検知ルール、署名欄を含む印刷用A4対応報告書',
      'Cancel': 'キャンセル',
      'Please specify both start (From) and end (To) dates.': '開始日と終了日の両方を指定してください。',
      'Start date must be earlier than or equal to end date.': '開始日は終了日以前の日付を指定してください。',

      // ── INTERVENTION REPORT (rapport.php) ──
      '← Back to Dashboard': '← ダッシュボードに戻る',
      'Back to Dashboard': 'ダッシュボードに戻る',
      '🖨️ Print / Save as PDF': '🖨️ 印刷 / PDF保存',
      'Print / Save as PDF': '印刷 / PDF保存',
      'Intervention Report': '対応報告書',
      'Period:': '対象期間：',
      'Generated:': '生成日時：',
      'Inspector:': '検査責任者：',
      'Sector Name': 'セクター名',
      'Physical Address': '設置先住所',
      'GPS Coordinates': 'GPS座標',
      'System & Valve State': 'システム・バルブ状態',
      'Total Consumption': '総使用量',
      'Over period (Δt rule)': '期間累計（Δtルール）',
      'Preserved via shutoff': 'バルブ閉鎖による保全量',
      'Flow Dynamics': '流量推移',
      'avg': '平均',
      'max': '最大',
      'L/min flow range': 'L/min 流量範囲',
      'Automatic Closures': '自動閉鎖回数',
      'events': '回',
      'alert incidents total': '件のアラート事象',
      '📊 Flow Monitoring Over Period': '📊 期間中の流量監視',
      '🚨 Detected Incidents & Actuation Log': '🚨 検知インシデント・動作ログ',
      'Start Time': '開始日時',
      'Anomaly Type': '異常タイプ',
      'Action Taken': '実行対応',
      'End Time': '終了日時',
      'Duration': '継続時間',
      '✓ No leak or anomaly incidents recorded during this period.': '✓ この期間中に記録された漏水または異常インシデントはありません。',
      '🔒 Automatic closure': '🔒 自動閉鎖',
      'Automatic closure': '自動閉鎖',
      '⚠️ Alert': '⚠️ アラート',
      'Ongoing': '進行中',
      '📱 Emergency Notifications Sent': '📱 緊急通知配信履歴',
      'Channel': 'チャネル',
      'Recipient (Masked)': '送信先（マスク済み）',
      'Delivery Status': '配信状態',
      'No emergency notifications were transmitted during this period.': 'この期間中に送信された緊急通知はありません。',
      '⚙️ Active Detection Rules (Config Calibration)': '⚙️ 稼働中検知ルール（設定パラメータ）',
      'Rule': 'ルール',
      'Name': '名称',
      'Thresholds & Parameters': 'しきい値とパラメータ',
      'Action': '対応動作',
      'Pipe Burst (Rupture)': '管路破裂',
      '🔒 Automatic valve shutoff': '🔒 自動バルブ遮断',
      'Daytime Threshold': '日中しきい値',
      '⚠️ Alert triggered': '⚠️ アラート発信',
      'Minimum Night Flow (MNF)': '夜間漏水（夜間最小流量）',
      'Sudden Flow Spike (Pic)': '急激な流量変化',
      'Micro-Leak (Slow Seepage)': '微小漏水（緩やかな滲出）',
      '⚠️ Alert (Valve open under watch)': '⚠️ アラート（バルブ開・監視継続）',
      'Flow ≥ 10.0 L/min for 3 consecutive readings': '流量 ≥ 10.0 L/min が 3 回連続',
      'Flow > 5.0 L/min': '流量 > 5.0 L/min',
      'Flow > 0.30 L/min sustained in night window': '夜間帯において流量 > 0.30 L/min が継続',
      'Z-score > 3.0 (std ≥ 0.2, jump ≥ 1.0 L/min)': 'Zスコア > 3.0（標準偏差 ≥ 0.2、変化量 ≥ 1.0 L/min）',
      'Flow in ]1.5, 5.0[ L/min sustained for 10 readings': '流量 ]1.5, 5.0[ L/min が 10 回連続継続',
      'Date-Time': '送信日時',
      '● Failed': '● 送信失敗',
      '✓ Sent': '✓ 送信済み',
      '✓ Simulated': '✓ シミュレーション',
      'Valve OPEN · State: NORMAL': 'バルブ 開 · 状態: 正常',
      'Valve CLOSED · State: NORMAL': 'バルブ 閉 · 状態: 正常',
      'Valve OPEN · State: Normal': 'バルブ 開 · 状態: 正常',
      'Valve CLOSED · State: Normal': 'バルブ 閉 · 状態: 正常',
      'Valve OPEN · State: Alert': 'バルブ 開 · 状態: アラート',
      'Valve CLOSED · State: Alert': 'バルブ 閉 · 状態: アラート',
      'Valve CLOSED · State: Closed': 'バルブ 閉 · 状態: 閉鎖',
      'Valve OPEN · State: Closed': 'バルブ 開 · 状態: 閉鎖',
      'Valve OPEN · State: ALERTE': 'バルブ 開 · 状態: アラート',
      'Valve CLOSED · State: FERMEE': 'バルブ 閉 · 状態: 閉鎖',
      'Valve CLOSED · State: ALERTE': 'バルブ 閉 · 状態: アラート',
      '(UTC+1)': '（UTC+1）',
      'CONNECTED': '接続中',
      'Click Switch Account to sign in': 'アカウントを切り替えてログイン',
      'Technician session active': '技術者セッション有効',
      'KIZUNA Technician (Guest)': 'KIZUNA技術者（ゲスト）',
      'KIZUNA Technician': 'KIZUNA技術者',
      'Technician (Guest)': '技術者（ゲスト）',
      'Sector A — ESPRIT Zone / El Ghazala': 'セクターA — ESPRIT Zone / El Ghazala',
      'ESPRIT Campus / El Ghazala Technology Park, Ariana': 'ESPRIT Campus / El Ghazala Technology Park, Ariana',
      'Sector B — Greater Tunis · Sidi Thabet': 'セクターB — Greater Tunis · Sidi Thabet',
      'Sector C — Cap Bon · Nabeul': 'セクターC — Cap Bon · Nabeul',
      'Sector D — Sahel · Sousse': 'セクターD — Sahel · Sousse',
      '✍️ Field Intervention Notes & Sign-off': '✍️ 現場対応メモおよび承認署名',
      'Intervention Date': '対応日',
      'Technician Name': '技術者氏名',
      'Signature & Stamp': '署名・捺印',
      'HydroMind — Smart Water Management System · Real-time Monitoring': 'HydroMind — スマート給水管理システム · リアルタイム監視',
      'HydroMind — Smart Water Management System · Hackathon KIZUNA 2026': 'HydroMind — スマート給水管理システム · ハッカソン KIZUNA 2026',
      'Official Intervention Document · Sector A Validation': '公式対応報告書 · セクターA検証',
      'No data for this period': 'この期間のデータはありません',

      // ── DYNAMIC TEMPLATES ──
      '{flow} <small>L/min</small>': '{flow} <small>L/min</small>',
      '{type} — Valve Closed': '{type} — バルブ閉',
      'Flow: {flow} L/min — Automatic safety closure': '流量：{flow} L/min — 自動安全閉鎖',
      '{type} — Anomaly': '{type} — 異常',
      'Flow: {flow} L/min — Under monitoring': '流量：{flow} L/min — 監視中',
      'Valve Reopened — Back to normal': 'バルブ再開 — 正常復帰',
      'Flow: {flow} L/min — Operational range restored': '流量：{flow} L/min — 正常稼働範囲に復帰',
      '{type} — Under monitoring': '{type} — 監視中',
      'Flow: {flow} L/min — Surveillance in progress': '流量：{flow} L/min — 監視継続中',
      '💧 {saved} L of water saved ({avoided} L/min being saved)': '💧 節水量 {saved} L（毎分 {avoided} L/min 節水中）',
      '💧 {saved} L of water saved': '💧 節水量 {saved} L',
      '💧 {saved} L ({avoided} L/min saved)': '💧 節水量 {saved} L（毎分 {avoided} L/min 節水中）',
      '💧 {saved} L': '💧 節水量 {saved} L',
      '{type} · Closed {time}.': '{type} · {time}に閉鎖。',
      '{type} · Valve closed automatically.': '{type} · バルブが自動閉鎖されました。',
      '{type} · Active monitoring in progress.': '{type} · 監視を継続中。',
      '{type} · Active since {time}.': '{type} · {time}より発生中。',
      '{type} · Automatic emergency shutoff.': '{type} · 自動緊急遮断を実行。',
      '{type} · Current flow: {flow} L/min.': '{type} · 現在の流量：{flow} L/min。',
      'Unusual flow detected: {flow} L/min.': '{flow} L/minの異常流量を検知。',
      'Hello, {name} <span>✦</span>': 'こんにちは、{name}さん <span>✦</span>',
      '{count} measurements': '{count}件の計測データ',
      'Valve closed – {avoided} L/min avoided': 'バルブ閉 — {avoided} L/min 回避',
      'Flow ≥ {val} L/min for {n} consecutive readings': '流量 ≥ {val} L/min が {n} 回連続',
      'Flow > {val} L/min': '流量 > {val} L/min',
      'Flow > {val} L/min sustained in night window': '夜間帯において流量 > {val} L/min が継続',
      'Z-score > {val} (std ≥ {std}, jump ≥ {jump} L/min)': 'Zスコア > {val}（標準偏差 ≥ {std}、変化量 ≥ {jump} L/min）',
      'Flow in ]{min}, {max}[ L/min sustained for {n} readings': '流量 ]{min}, {max}[ L/min が {n} 回連続継続',
      'No consumption or alert measurements were recorded between {du} and {au}.': '{du}から{au}の期間に記録された使用量およびアラートデータはありません。',
      'Alert Threshold ({threshold} L/min)': '警告しきい値 ({threshold} L/min)',
      'Alert threshold ({threshold} L/min)': '警告しきい値 ({threshold} L/min)',
      'Valve {status} · State: {state}': 'バルブ {status} · 状態: {state}',
      '{avg}avg / {max}max': '{avg}平均 / {max}最大',
      '{events}events': '{events}回',
      '{total} alert incidents total': '合計 {total} 件のアラート事象',
      'Channels: {channels}': '通知チャネル：{channels}',
      'Sensor offline – live monitoring suspended': 'センサーオフライン — ライブ監視停止中',
      'Live telemetry paused · Awaiting next sensor transmission.': 'テレメトリ一時停止中 · 次回センサー送信待機中',
      'Anomaly detected – sensor offline': '異常検知 — センサーオフライン',
      '{type} · Last known flow: {flow} L/min · Telemetry paused.': '{type} · 最終確認流量：{flow} L/min · テレメトリ一時停止中',
      'Unusual flow detected: {flow} L/min (last known) · Telemetry paused.': '異常流量を検知：{flow} L/min（最終確認値）· テレメトリ一時停止中',
      'Sensor offline — last reading {sec} s ago': 'センサーオフライン — 最終計測 {sec}秒前',
      'Sensor offline — last reading {sec}s ago': 'センサーオフライン — 最終計測 {sec}秒前',
      'Paused — {count} new readings': '一時停止中 — 新着{count}件',
      'Paused — {count} new reading': '一時停止中 — 新着{count}件',
      'Paused — 0 new readings': '一時停止中 — 新着0件',
      'Trend watch: flow rising +{pente} L/min per minute — threshold reachable in ~{eta}': '傾向監視：流量が毎分 +{pente} L/min 増加中 — 約{eta}でしきい値到達予測',
      'Trend watch: flow rising +{pente} L/min per minute – threshold reachable in ~{eta}': '傾向監視：流量が毎分 +{pente} L/min 増加中 — 約{eta}でしきい値到達予測',
      'Trend watch: flow rising +0.10 L/min per minute — threshold reachable in ~15 min': '傾向監視：流量が毎分 +0.10 L/min 増加中 — 約15分でしきい値到達予測',
      'Trend: +{pente} L/min per minute (fit R² = {r2} over the last 12 readings)': '傾向：毎分 +{pente} L/min 増加（過去12回計測で決定係数 R² = {r2}）',
      'Estimated time to reach {cible} L/min ({label}): ~{eta}': '{cible} L/min（{label}）到達予測時間：~{eta}',
      'Prediction based on flow trend — not a confirmed leak. Inspection recommended.': '流量傾向に基づく予測（未確定の漏水）— 点検を推奨します。'
    }
  };

  const enTranslations = {
    'HydroMind': 'HydroMind',
    'HydroMind · Real-time Monitoring': 'HydroMind · Real-time Monitoring',
    'HydroMind · Hackathon KIZUNA 2026': 'HydroMind · Real-time Monitoring'
  };

  function getSavedLanguage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'jp' ? 'jp' : 'en';
  }

  function setLanguage(language) {
    if (language !== 'jp') language = 'en';
    const previous = getSavedLanguage();
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language === 'jp' ? 'ja' : 'en';

    if (previous === 'jp' && language !== 'jp') {
      window.location.reload();
      return;
    }

    applyTranslations(language);
    document.querySelectorAll('[data-kizuna-language]').forEach(button => {
      button.classList.toggle('active', button.dataset.kizunaLanguage === language);
    });

    window.dispatchEvent(new CustomEvent('kizuna-language-change', { detail: { language } }));
  }

  const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
  const ATTR_SELECTOR = ATTRS.map(a => `[${a}]`).join(',');

  function translateElementAttrs(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
    const isJp = getSavedLanguage() === 'jp';

    ATTRS.forEach(attr => {
      if (!el.hasAttribute(attr)) return;
      const currentVal = el.getAttribute(attr);
      if (!currentVal) return;
      const origKey = `data-orig-${attr}`;

      if (isJp) {
        const origVal = el.getAttribute(origKey) || currentVal.trim();
        if (!el.hasAttribute(origKey)) {
          el.setAttribute(origKey, origVal);
        }
        if (translations.jp[origVal]) {
          const target = translations.jp[origVal];
          if (currentVal !== target) {
            el.setAttribute(attr, target);
          }
        }
      } else {
        if (el.hasAttribute(origKey)) {
          el.setAttribute(attr, el.getAttribute(origKey));
        }
      }
    });
  }

  function translateTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    if (!node.parentElement) return;
    if (node.parentElement.closest('script, style, code, pre')) return;

    const exact = node.textContent.trim();
    if (!exact) return;

    if (translations.jp[exact]) {
      const leading = node.textContent.match(/^\s*/)?.[0] || '';
      const trailing = node.textContent.match(/\s*$/)?.[0] || '';
      const replacement = leading + translations.jp[exact] + trailing;
      if (node.textContent !== replacement) {
        node.textContent = replacement;
      }
    }
  }

  function applyTranslations(language) {
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.dataset.i18n;
      if (language === 'jp' && translations.jp[key]) element.textContent = translations.jp[key];
      if (language === 'en' && enTranslations[key]) element.textContent = enTranslations[key];
    });

    if (language !== 'jp') {
      if (document._origTitle) document.title = document._origTitle;
      return;
    }

    // Page <title>
    if (!document._origTitle) document._origTitle = document.title;
    const trimmedTitle = document._origTitle.trim();
    if (translations.jp[trimmedTitle]) {
      document.title = translations.jp[trimmedTitle];
    }

    // Attributes
    document.querySelectorAll(ATTR_SELECTOR).forEach(translateElementAttrs);

    // Text nodes walker
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.parentElement) return NodeFilter.FILTER_REJECT;
        if (node.parentElement.closest('script, style, code, pre')) return NodeFilter.FILTER_REJECT;
        const text = node.textContent.trim();
        return translations.jp[text] ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(translateTextNode);
  }

  function injectLanguageSelector() {
    if (document.querySelector('.language-switcher')) return;
    const switcher = document.createElement('div');
    switcher.className = 'language-switcher';
    switcher.setAttribute('aria-label', 'Language selection');
    switcher.innerHTML = `
      <button type="button" data-kizuna-language="en" title="English">EN</button>
      <button type="button" data-kizuna-language="jp" title="日本語">JP</button>
    `;
    switcher.querySelectorAll('button').forEach(button => {
      button.addEventListener('click', () => setLanguage(button.dataset.kizunaLanguage));
    });
    document.body.appendChild(switcher);
  }

  window.KizunaI18n = {
    t(key, params, language) {
      if (typeof params === 'string' && language === undefined) {
        language = params;
        params = null;
      }
      const active = language || getSavedLanguage();
      let template = (active === 'jp' && translations.jp[key]) ? translations.jp[key] : key;
      if (params && typeof params === 'object') {
        Object.keys(params).forEach(k => {
          template = template.replaceAll(`{${k}}`, params[k]);
        });
      }
      return template;
    },
    setLanguage,
    getLanguage: getSavedLanguage,
    translations
  };

  document.addEventListener('DOMContentLoaded', () => {
    injectLanguageSelector();
    setLanguage(getSavedLanguage());

    const observer = new MutationObserver(mutations => {
      if (getSavedLanguage() !== 'jp') return;
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) {
            translateTextNode(node);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.matches && node.matches(ATTR_SELECTOR)) {
              translateElementAttrs(node);
            }
            node.querySelectorAll?.(ATTR_SELECTOR)?.forEach(translateElementAttrs);

            const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
              acceptNode(n) {
                if (!n.parentElement) return NodeFilter.FILTER_REJECT;
                if (n.parentElement.closest('script, style, code, pre')) return NodeFilter.FILTER_REJECT;
                const text = n.textContent.trim();
                return translations.jp[text] ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
              }
            });
            const subNodes = [];
            while (walker.nextNode()) subNodes.push(walker.currentNode);
            subNodes.forEach(translateTextNode);
          }
        });

        if (mutation.type === 'characterData' && mutation.target.nodeType === Node.TEXT_NODE) {
          translateTextNode(mutation.target);
        }
      });
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
})();
