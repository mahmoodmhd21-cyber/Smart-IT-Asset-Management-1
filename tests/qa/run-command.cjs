const { spawn } = require('node:child_process');

// Bound QA commands so a stalled dependency or compiler cannot hang the audit.
const [seconds, command, ...args] = process.argv.slice(2);
const child = spawn(command, args, { stdio: 'inherit', detached: true });
let timedOut = false;
const timer = setTimeout(() => {
  timedOut = true;
  console.error(`QA timeout after ${seconds}s: ${command}`);
  process.kill(-child.pid, 'SIGTERM');
}, Number(seconds) * 1000);
child.on('error', (error) => {
  clearTimeout(timer);
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  clearTimeout(timer);
  process.exitCode = timedOut ? 124 : (code ?? 1);
});
