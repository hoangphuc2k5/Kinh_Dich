import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { getPythonExecutable } from './resolve-python.js';

const ROOT = join(import.meta.dirname, '..');
const python = getPythonExecutable();
const pdfScript = join(ROOT, 'scripts', 'pdf_pipeline.py');

function spawnNpm(script: string): ChildProcess {
  const options = { stdio: 'inherit' as const, cwd: ROOT, windowsHide: true };
  // Windows: npm.cmd không chạy được với shell:false (EINVAL trên Node mới).
  if (process.platform === 'win32') {
    return spawn('npm', ['run', script], { ...options, shell: true });
  }
  return spawn('npm', ['run', script], { ...options, shell: false });
}

function spawnPython(): ChildProcess {
  return spawn(python, [pdfScript, '--watch'], {
    stdio: 'inherit',
    cwd: ROOT,
    shell: false,
    windowsHide: true,
  });
}

const processes = [spawnNpm('dev'), spawnNpm('server'), spawnPython()];
const stop = () => processes.forEach((child) => child.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
processes.forEach((child, index) => {
  child.on('error', (error) => console.error(`Service ${index + 1} failed to start: ${error.message}`));
  child.on('exit', (code) => { if (code && code !== 0) process.exitCode = code; });
});
