import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

function spawnNpm(script: string): ChildProcess {
  const options = { stdio: 'inherit' as const, cwd: ROOT, windowsHide: true };
  if (process.platform === 'win32') {
    return spawn('npm', ['run', script], { ...options, shell: true });
  }
  return spawn('npm', ['run', script], { ...options, shell: false });
}

const processes = [spawnNpm('dev'), spawnNpm('server')];
const stop = () => processes.forEach((child) => child.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
processes.forEach((child, index) => {
  child.on('error', (error) => console.error(`Service ${index + 1} failed to start: ${error.message}`));
  child.on('exit', (code) => { if (code && code !== 0) process.exitCode = code; });
});
