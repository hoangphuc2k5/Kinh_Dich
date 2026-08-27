import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

function spawnProcess(command: string, args: string[], useShell = true): ChildProcess {
  const options = { stdio: 'inherit' as const, cwd: ROOT, windowsHide: true };
  return spawn(command, args, { ...options, shell: useShell });
}

const processes = [spawnProcess('vercel', ['dev', '--listen', '3000'])];
const stop = () => processes.forEach((child) => child.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
processes.forEach((child, index) => {
  child.on('error', (error) => {
    console.error(`[service ${index + 1}] start error: ${error.message}`);
    if (/vercel/i.test(error.message) || error.message.includes('ENOENT')) {
      console.error('>>> Vercel CLI chưa được cài đặt. Chạy: npm install -g vercel ; vercel login');
    }
  });
  child.on('exit', (code) => { if (code && code !== 0) process.exitCode = code; });
});
