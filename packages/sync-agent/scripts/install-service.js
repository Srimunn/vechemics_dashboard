// Installs the VChemics sync agent as a Windows Service via node-windows.
// Run from the sync-agent package root:  npm run service:install
//
// Prereq: build first (`npm run build`) so dist/index.js exists, and install
// node-windows (it's an optionalDependency): `npm install node-windows`.
import { Service } from 'node-windows';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const script = join(__dirname, '..', 'dist', 'index.js');

if (!existsSync(script)) {
  console.error(`Build output not found at ${script}. Run "npm run build" first.`);
  process.exit(1);
}

const svc = new Service({
  name: 'VChemics Sync Agent',
  description: 'Reads TallyPrime data and pushes it to the VChemics dashboard backend.',
  script,
  nodeOptions: [],
  // Restart on failure.
  wait: 2,
  grow: 0.5,
  maxRestarts: 10,
});

svc.on('install', () => {
  console.log('Service installed. Starting…');
  svc.start();
});
svc.on('alreadyinstalled', () => console.log('Service is already installed.'));
svc.on('start', () => console.log('VChemics Sync Agent started.'));
svc.on('error', (err) => console.error('Service error:', err));

svc.install();
