// Uninstalls the VChemics sync agent Windows Service.
// Run:  npm run service:uninstall
import { Service } from 'node-windows';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const svc = new Service({
  name: 'VChemics Sync Agent',
  script: join(__dirname, '..', 'dist', 'index.js'),
});

svc.on('uninstall', () => console.log('VChemics Sync Agent uninstalled.'));
svc.on('error', (err) => console.error('Service error:', err));

svc.uninstall();
