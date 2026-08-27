import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { getPythonExecutable, venvPythonPath } from './resolve-python.js';

const ROOT = join(import.meta.dirname, '..');
const venvDir = join(ROOT, '.venv');
const venvPython = venvPythonPath(ROOT);
const requirements = join(ROOT, 'requirements.txt');

function bootstrapPython(): string {
  if (process.env.PYTHON_BOOTSTRAP) return process.env.PYTHON_BOOTSTRAP;
  if (process.platform === 'win32') {
    const pyLauncher = spawnSync('py', ['-3', '--version'], { encoding: 'utf8' });
    if (pyLauncher.status === 0) return 'py';
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

function run(command: string, args: string[]): number {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  });
  return result.status ?? 1;
}

function venvRunnable(): boolean {
  if (!existsSync(venvPython)) return false;
  return run(venvPython, ['--version']) === 0;
}

function depsInstalled(): boolean {
  if (!venvRunnable()) return false;
  return run(venvPython, ['-c', 'import pymupdf']) === 0;
}

function createVenv(): void {
  console.log('Tạo môi trường Python tại .venv …');
  if (existsSync(venvDir)) {
    rmSync(venvDir, { recursive: true, force: true });
  }
  const bootstrap = bootstrapPython();
  const args = bootstrap === 'py'
    ? ['-3', '-m', 'venv', venvDir]
    : ['-m', 'venv', venvDir];
  const code = run(bootstrap, args);
  if (code !== 0) {
    console.error('Không tạo được .venv. Cài Python 3.10+ rồi chạy lại: npm run setup:python');
    process.exit(code);
  }
}

function installDeps(): void {
  console.log('Cài dependencies từ requirements.txt …');
  const pipIndex = ['--index-url', 'https://pypi.org/simple'];
  const upgrade = run(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip', ...pipIndex]);
  if (upgrade !== 0) process.exit(upgrade);
  const install = run(venvPython, ['-m', 'pip', 'install', '-r', requirements, ...pipIndex]);
  if (install !== 0) process.exit(install);
}

if (!venvRunnable()) {
  createVenv();
}

if (!depsInstalled()) {
  installDeps();
}

if (!depsInstalled()) {
  console.error('Thiếu pymupdf sau khi cài. Kiểm tra kết nối mạng và chạy lại: npm run setup:python');
  process.exit(1);
}

console.log(`Python pipeline sẵn sàng: ${getPythonExecutable()}`);
