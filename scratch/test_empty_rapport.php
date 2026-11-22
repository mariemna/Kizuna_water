<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

$_SESSION['worker'] = ['id' => 1, 'nom_complet' => 'Technicien Test'];
$_GET = ['du' => '2025-01-01', 'au' => '2025-01-01'];

ob_start();
require __DIR__ . '/../rapport.php';
$html = ob_get_clean();

echo "Length: " . strlen($html) . PHP_EOL;
if (strpos($html, 'No data for this period') !== false) {
    echo "PASS: 'No data for this period' found in empty report!\n";
} else {
    echo "FAIL: 'No data for this period' not found.\n";
}
