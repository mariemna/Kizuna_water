<?php
require_once __DIR__ . '/../config.php';
$pdo = getPDO();
$phpTime = date('Y-m-d H:i:s');
$mysqlTime = $pdo->query('SELECT NOW()')->fetchColumn();
echo "PHP Time:   {$phpTime}\n";
echo "MySQL Time: {$mysqlTime}\n";
echo ($phpTime === $mysqlTime) ? "PASS: Exactly synchronized!\n" : "FAIL: Times differ!\n";
