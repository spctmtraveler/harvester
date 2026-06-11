<?php
/**
 * Image Library Index — browse uploaded Designer images
 * Location: /harvester/api/image-library-index.php
 *
 * Returns a JSON list of files in /harvester/uploads/images/ sorted by newest first.
 */

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = ['https://happydo.xyz', 'http://localhost', 'http://127.0.0.1'];
$originAllowed = false;
foreach ($allowed as $a) {
    if (stripos($origin, $a) === 0) { $originAllowed = true; break; }
}
if ($originAllowed) {
    header("Access-Control-Allow-Origin: $origin");
}
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Only GET requests accepted.']);
    exit;
}

$uploadDir = realpath(__DIR__ . '/../uploads/images');
$publicBase = 'https://happydo.xyz/harvester/uploads/images/';
$allowedExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];

if (!$uploadDir || !is_dir($uploadDir)) {
    echo json_encode(['ok' => true, 'count' => 0, 'items' => []]);
    exit;
}

$entries = [];
$dirItems = scandir($uploadDir);
if ($dirItems === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Failed to read uploads directory.']);
    exit;
}

foreach ($dirItems as $name) {
    if ($name === '.' || $name === '..') continue;
    $fullPath = $uploadDir . DIRECTORY_SEPARATOR . $name;
    if (!is_file($fullPath)) continue;
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExt, true)) continue;

    $mtime = @filemtime($fullPath);
    $size = @filesize($fullPath);
    $entries[] = [
        'filename' => $name,
        'url' => $publicBase . rawurlencode($name),
        'sizeBytes' => $size === false ? null : $size,
        'modifiedTs' => $mtime === false ? 0 : (int)$mtime,
        'modifiedIso' => $mtime === false ? null : gmdate('c', (int)$mtime),
        'extension' => $ext,
    ];
}

usort($entries, static function ($a, $b) {
    $timeCompare = ($b['modifiedTs'] ?? 0) <=> ($a['modifiedTs'] ?? 0);
    if ($timeCompare !== 0) return $timeCompare;
    return strcmp($a['filename'] ?? '', $b['filename'] ?? '');
});

echo json_encode([
    'ok' => true,
    'count' => count($entries),
    'items' => $entries,
], JSON_UNESCAPED_SLASHES);