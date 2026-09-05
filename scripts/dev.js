// Runs backend + frontend dev servers together (no extra dependencies).
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function run(name, cwd, color) {
  const child = spawn('npm', ['run', 'dev'], { cwd: path.join(root, cwd), shell: true });
  const tag = `\x1b[${color}m[${name}]\x1b[0m`;
  const pipe = (data) =>
    data.toString().split('\n').filter(Boolean).forEach((l) => console.log(`${tag} ${l}`));
  child.stdout.on('data', pipe);
  child.stderr.on('data', pipe);
  child.on('exit', (code) => console.log(`${tag} exited with code ${code}`));
  return child;
}
console.log('Starting PropFlow dev servers...\n');
const backend = run('backend', 'backend', '36'); // cyan
const frontend = run('frontend', 'frontend', '35'); // magenta
const stop = () => { backend.kill(); frontend.kill(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
