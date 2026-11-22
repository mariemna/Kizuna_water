<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

$_SESSION['worker'] = ['id' => 1, 'nom_complet' => 'Technicien Test'];
$_GET = ['type' => 'mesures', 'du' => '2025-01-01', 'au' => '2025-01-01'];

ob_start();
require __DIR__ . '/../exporter.php';
$out = ob_get_clean();

echo "Length: " . strlen($out) . PHP_EOL;
echo "Preview:\n" . substr($out, 3, 200) . PHP_EOL;
