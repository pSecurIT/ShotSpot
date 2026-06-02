import { spawn } from 'node:child_process';

const child = spawn('npm run build', {
  shell: true,
  stdio: 'inherit',
  env: {
    ...process.env,
    ANALYZE: 'true'
  }
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
