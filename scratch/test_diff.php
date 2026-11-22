<?php
require_once __DIR__ . '/../config.php';
$pdo = getPDO();
$stmt = $pdo->query('SELECT NOW() as now_time, MAX(timestamp) as max_ts, TIMESTAMPDIFF(SECOND, MAX(timestamp), NOW()) AS seconds_since_last_reading FROM consommation');
$row = $stmt->fetch(PDO::FETCH_ASSOC);
echo json_encode($row, JSON_PRETTY_PRINT) . PHP_EOL;
