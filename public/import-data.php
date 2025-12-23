<?php
// Simple database importer - run once then delete
// Access via: https://your-app.up.railway.app/import-data.php

$sqlFile = __DIR__ . '/../database/navigator_export.sql';

if (!file_exists($sqlFile)) {
    die("SQL file not found!");
}

echo "Reading SQL file...<br>";
$sql = file_get_contents($sqlFile);

echo "Connecting to database...<br>";
$host = env('DB_HOST');
$database = env('DB_DATABASE');
$username = env('DB_USERNAME');
$password = env('DB_PASSWORD');

try {
    $pdo = new PDO("mysql:host=$host;dbname=$database", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "Disabling foreign key checks...<br>";
    $pdo->exec('SET FOREIGN_KEY_CHECKS=0;');
    
    echo "Importing data...<br>";
    $pdo->exec($sql);
    
    echo "Re-enabling foreign key checks...<br>";
    $pdo->exec('SET FOREIGN_KEY_CHECKS=1;');
    
    echo "<h2 style='color: green;'>✅ Database imported successfully!</h2>";
    echo "<p>You can now delete this file (import-data.php)</p>";
    
} catch (PDOException $e) {
    echo "<h2 style='color: red;'>❌ Import failed:</h2>";
    echo "<p>" . $e->getMessage() . "</p>";
}
