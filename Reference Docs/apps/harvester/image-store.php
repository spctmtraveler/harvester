<?php
/**
 * Image Store — Server-side upload endpoint for Designer app
 * Location: /harvester/api/image-store.php
 * 
 * Accepts POST with multipart image file, saves to /harvester/uploads/images/
 * Returns JSON with the public URL of the stored image.
 * 
 * Security:
 *  - Only allows image MIME types (jpeg, png, gif, webp, svg+xml)
 *  - Max file size: 10 MB
 *  - UUID filenames to prevent overwrite/traversal
 *  - CORS restricted to happydo.xyz
 * 
 * Usage:
 *  POST /harvester/api/image-store.php
 *  Body: multipart/form-data with field "image"
 *  Response: { "ok": true, "url": "https://happydo.xyz/harvester/uploads/images/abc123.png", "filename": "abc123.png", "size": 123456 }
 *  Error:   { "ok": false, "error": "Description" }
 */

// ── CORS ──
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = ['https://happydo.xyz', 'http://localhost', 'http://127.0.0.1'];
$originAllowed = false;
foreach ($allowed as $a) {
    if (stripos($origin, $a) === 0) { $originAllowed = true; break; }
}
if ($originAllowed) {
    header("Access-Control-Allow-Origin: $origin");
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Config ──
$maxBytes    = 10 * 1024 * 1024; // 10 MB
$uploadDir   = __DIR__ . '/../uploads/images/';
$publicBase  = 'https://happydo.xyz/harvester/uploads/images/';
$allowedMime = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
$mimeToExt   = [
    'image/jpeg'    => 'jpg',
    'image/png'     => 'png',
    'image/gif'     => 'gif',
    'image/webp'    => 'webp',
    'image/svg+xml' => 'svg',
];

// ── Helpers ──
function fail($msg, $code = 400) {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

function uuid4() {
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

// ── Validate request ──
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Only POST requests accepted.', 405);
}

if (!isset($_FILES['image'])) {
    fail('Missing "image" field in upload.');
}

$file = $_FILES['image'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    $errMap = [
        UPLOAD_ERR_INI_SIZE   => 'File exceeds server limit.',
        UPLOAD_ERR_FORM_SIZE  => 'File exceeds form limit.',
        UPLOAD_ERR_PARTIAL    => 'File only partially uploaded.',
        UPLOAD_ERR_NO_FILE    => 'No file received.',
        UPLOAD_ERR_NO_TMP_DIR => 'Server missing temp directory.',
        UPLOAD_ERR_CANT_WRITE => 'Server cannot write file.',
    ];
    fail($errMap[$file['error']] ?? 'Upload error code ' . $file['error'], 500);
}

if ($file['size'] > $maxBytes) {
    fail('File too large (max 10 MB).');
}

// Verify MIME type
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime  = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!in_array($mime, $allowedMime, true)) {
    fail("Unsupported image type: $mime");
}

// ── Save ──
if (!is_dir($uploadDir)) {
    if (!mkdir($uploadDir, 0755, true)) {
        fail('Cannot create upload directory.', 500);
    }
}

$ext      = $mimeToExt[$mime] ?? 'bin';
$filename = uuid4() . '.' . $ext;
$dest     = $uploadDir . $filename;

if (!move_uploaded_file($file['tmp_name'], $dest)) {
    fail('Failed to move uploaded file.', 500);
}

// ── Respond ──
echo json_encode([
    'ok'       => true,
    'url'      => $publicBase . $filename,
    'filename' => $filename,
    'size'     => $file['size'],
]);
