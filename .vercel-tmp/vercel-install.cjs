#!/usr/bin/env node
/**
* Vercel CLI Installation Script (Cross-Platform)
* Usage: node install.cjs
* Works on: Windows, macOS, Linux
  */
const { spawnSync } = require('child_process');
const os = require('os');
const isWindows = os.platform() === 'win32';
// Whitelist of allowed command names to prevent command injection
const ALLOWED_COMMANDS = new Set(['node', 'npm', 'pnpm', 'yarn', 'vercel']);
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
function checkNode() {
if (!commandExists('node')) {
log('Error: Node.js is not installed');
log('Please install Node.js (v16+) first: https://nodejs.org/');
process.exit(1);
}
const version = getCommandOutput('node', ['-v']);
log(`Detected Node.js: ${version}`);
}
function checkVercel() {
if (commandExists('vercel')) {
const version = getCommandOutput('vercel', ['--version']) || 'unknown';
log(`Vercel CLI installed: ${version}`);
return true;
}
return false;
}
function detectPackageManager() {
if (commandExists('pnpm')) return 'pnpm';
if (commandExists('yarn')) return 'yarn';
if (commandExists('npm')) return 'npm';
return null;
}
function installVercel(pkgManager) {
log(`Installing Vercel CLI using ${pkgManager}...`);
log('');
const commands = {
pnpm: ['pnpm', ['add', '-g', 'vercel']],
yarn: ['yarn', ['global', 'add', 'vercel']],
npm: ['npm', ['install', '-g', 'vercel']]
};
const entry = commands[pkgManager];
if (!entry) {
log('Error: No available package manager found (npm/pnpm/yarn)');
process.exit(1);
}
try {
const result = spawnSync(entry[0], entry[1], { stdio: 'inherit', shell: isWindows });
if (result.status !== 0) throw new Error(`Exit code: ${result.status}`);
} catch (error) {
log(`Installation failed: ${error.message}`);
process.exit(1);
}
}
function main() {
log('========================================');
log('Vercel CLI Installation Script');
log('========================================');
log('');
checkNode();
if (checkVercel()) {
log('');
log('Vercel CLI is already installed, no need to reinstall.');
log('To update, run: npm update -g vercel');
log('');
console.log(JSON.stringify({ status: 'already_installed', message: 'Vercel CLI already installed' }));
process.exit(0);
}
const pkgManager = detectPackageManager();
if (!pkgManager) {
log('Error: No package manager found (npm/pnpm/yarn)');
process.exit(1);
}
log(`Detected package manager: ${pkgManager}`);
log('');
installVercel(pkgManager);
log('');
if (checkVercel()) {
log('');
log('========================================');
log('Vercel CLI installed successfully!');
log('========================================');
log('');
log('Next step: Run login script to authorize');
log('');
console.log(JSON.stringify({ status: 'success', message: 'Vercel CLI installed successfully' }));
} else {
log('Error: Cannot find vercel command after installation');
log('Please check PATH environment variable or try reopening terminal');
process.exit(1);
}
}
main();
