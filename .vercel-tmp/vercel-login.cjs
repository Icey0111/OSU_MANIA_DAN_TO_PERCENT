#!/usr/bin/env node
/**
* Vercel CLI Login Authorization Script (Cross-Platform)
* Usage: node login.cjs
* Works on: Windows, macOS, Linux
*
* This script uses Node.js spawn with 'detached' mode to create a background
* vercel login process that continues running after the script exits.
  */
const { spawnSync, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const isWindows = os.platform() === 'win32';
// Create a secure temporary log file under .vercel-tmp in current working directory
function createSecureLogFile() {
const tmpDir = path.join(process.cwd(), '.vercel-tmp');
if (!fs.existsSync(tmpDir)) {
fs.mkdirSync(tmpDir, { recursive: true });
}
// Restrict directory permissions on Unix (owner-only)
if (!isWindows) {
try { fs.chmodSync(tmpDir, 0o700); } catch (e) { /* best effort */ }
}
return path.join(tmpDir, 'login.log');
}
const LOG_FILE = createSecureLogFile();
// Whitelist of allowed command names to prevent command injection
const ALLOWED_COMMANDS = new Set(['vercel']);
function log(msg) {
console.error(msg);
}
function commandExists(cmd) {
if (!ALLOWED_COMMANDS.has(cmd)) {
throw new Error(`Command not in whitelist: ${cmd}`);
}
try {
if (isWindows) {
const result = spawnSync('where', [cmd], { stdio: 'ignore' });
return result.status === 0;
} else {
const result = spawnSync('sh', ['-c', `command -v "$1"`, '--', cmd], { stdio: 'ignore' });
return result.status === 0;
}
} catch {
return false;
}
}
function getCommandOutput(cmd, args) {
try {
const result = spawnSync(cmd, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], shell: isWindows });
return result.status === 0 ? (result.stdout || '').trim() : null;
} catch {
return null;
}
}
function checkVercelInstalled() {
if (!commandExists('vercel')) {
log('Error: Vercel CLI is not installed');
log('Please run install script first to install Vercel CLI');
process.exit(1);
}
const version = getCommandOutput('vercel', ['--version']) || 'unknown';
log(`Vercel CLI version: ${version}`);
}
function checkLoginStatus() {
log('');
log('Checking login status...');
try {
const result = spawnSync('vercel', ['whoami'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], shell: isWindows });
const output = (result.stdout || '').trim();
if (result.status === 0 && output && !output.includes('Error') && !output.includes('not logged in')) {
log(`Logged in as: ${output}`);
return true;
}
} catch {
// Not logged in
}
return false;
}
function sleep(ms) {
return new Promise(resolve => setTimeout(resolve, ms));
}
function startBackgroundLogin() {
// Use Node.js spawn with 'detached' to create a proper background process
// This is cross-platform safe and avoids shell command injection
const logStream = fs.openSync(LOG_FILE, 'w');
const child = spawn('vercel', ['login'], {
detached: true,
stdio: ['ignore', logStream, logStream],
shell: isWindows
});
// Allow the parent to exit without waiting for the child
child.unref();
log(`Background login process started (PID: ${child.pid})`);
log(`Log file: ${LOG_FILE}`);
// Store PID for potential cleanup
const pidFile = LOG_FILE + '.pid';
fs.writeFileSync(pidFile, String(child.pid));
return child.pid;
}
function openBrowser(url) {
// Validate URL strictly before passing to system commands
// Only allow the exact Vercel OAuth device URL pattern
const urlPattern = /^https:\/\/vercel\.com\/oauth\/device\?user_code=[A-Z0-9-]+$/;
if (!urlPattern.test(url)) {
log(`Error: URL does not match expected Vercel OAuth pattern: ${url}`);
log('Please open the URL manually');
return;
}
// Use spawnSync with arguments array to prevent shell injection
const platform = os.platform();
try {
if (platform === 'darwin') {
spawnSync('open', [url], { stdio: 'ignore' });
} else if (platform === 'win32') {
// Use PowerShell Start-Process on Windows — more reliable than cmd /c start
// in Git Bash/MSYS2 environments where special chars in URLs can be mishandled
spawnSync('powershell', ['-Command', `Start-Process '${url}'`], { stdio: 'ignore', windowsHide: true });
} else {
spawnSync('xdg-open', [url], { stdio: 'ignore' });
}
log('Browser opened automatically');
} catch (error) {
log(`Failed to open browser: ${error.message}`);
log('Please open the URL manually');
}
}
async function waitForAuthUrl() {
// Wait for URL to appear in log file (max 20 seconds)
for (let i = 0; i < 40; i++) {
await sleep(500);
    try {
      if (fs.existsSync(LOG_FILE)) {
        const content = fs.readFileSync(LOG_FILE, 'utf8');
        // Strict pattern with end anchor to avoid partial matches
        const match = content.match(/https:\/\/vercel\.com\/oauth\/device\?user_code=[A-Z0-9-]+(?=\s|$)/);
        if (match) {
          return match[0];
        }
      }
    } catch (e) {
      // File might not exist yet or be locked, this is expected during startup
      if (e.code !== 'ENOENT') {
        log(`Warning: Error reading log file: ${e.code || e.message}`);
      }
    }
}
return null;
}
function cleanup() {
// Clean up temp files on exit
try {
const pidFile = LOG_FILE + '.pid';
if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
// Note: LOG_FILE itself is intentionally kept for the background process
} catch (e) {
// Best effort cleanup
}
}
async function doLogin() {
log('');
log('Starting login authorization...');
log('');
const loginPid = startBackgroundLogin();
log('Waiting for authorization URL...');
const authUrl = await waitForAuthUrl();
if (authUrl) {
log('');
log('========================================');
log('Authorization URL extracted');
log(`vercel login is running in background (PID: ${loginPid})`);
log('Opening browser for authorization...');
log('========================================');
log('');
    // Automatically open browser
    openBrowser(authUrl);
    console.log(JSON.stringify({ status: 'needs_auth', auth_url: authUrl, log_file: LOG_FILE }));
} else {
log('Failed to get authorization URL');
log('Check log file for details: ' + LOG_FILE);
try {
const content = fs.readFileSync(LOG_FILE, 'utf8');
log('Log content: ' + content);
} catch (e) {
log(`Could not read log file: ${e.code || e.message}`);
}
process.exit(1);
}
}
async function main() {
log('========================================');
log('Vercel CLI Login Authorization');
log('========================================');
log('');
checkVercelInstalled();
if (checkLoginStatus()) {
log('');
log('========================================');
log('Already logged in, no need to login again');
log('========================================');
log('');
log('To switch accounts, run: vercel logout');
log('');
console.log(JSON.stringify({ status: 'already_logged_in', message: 'Already logged in' }));
process.exit(0);
}
await doLogin();
}
main();
