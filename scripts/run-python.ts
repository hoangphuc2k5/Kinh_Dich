import { spawn } from 'node:child_process';
import { getPythonExecutable } from './resolve-python.js';

const [, , script, ...args] = process.argv;
if (!script) {
  console.error('Usage: tsx scripts/run-python.ts <script.py> [args...]');
  process.exit(1);
}

const python = getPythonExecutable();
const child = spawn(python, [script, ...args], {
  stdio: 'inherit',
  shell: false,
  windowsHide: true,
});

child.on('error', (error) => {
  console.error(`Không chạy được ${python}: ${error.message}`);
  console.error('Chạy: npm run setup:python');
  process.exit(1);
});

child.on('exit', (code) => process.exit(code ?? 0));
