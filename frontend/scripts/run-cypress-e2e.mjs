import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';

const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';
const defaultPort = 3000;

const forwardedArgs = process.argv.slice(2);
const startupTimeoutMs = 60000;
const pollIntervalMs = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const spawnNpm = (args, options = {}) => spawn(npmCommand, args, {
  shell: isWindows,
  ...options,
});

const findAvailablePort = (preferredPort) => new Promise((resolve, reject) => {
  const server = net.createServer();

  server.unref();
  server.on('error', (error) => reject(error));

  server.listen(preferredPort, '127.0.0.1', () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : preferredPort;

    server.close((closeError) => {
      if (closeError) {
        reject(closeError);
        return;
      }

      resolve(port);
    });
  });
});

const waitForServer = async (url, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const isReady = await new Promise((resolve) => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve(response.statusCode === 200);
      });

      request.on('error', () => resolve(false));
      request.setTimeout(2000, () => {
        request.destroy();
        resolve(false);
      });
    });

    if (isReady) {
      return;
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(`Timed out waiting for Vite dev server at ${url}`);
};

const killProcessTree = (childProcess) => {
  if (!childProcess || childProcess.killed) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    if (isWindows) {
      const killer = spawn('taskkill', ['/pid', String(childProcess.pid), '/f', '/t'], {
        stdio: 'ignore'
      });

      killer.on('close', () => resolve());
      killer.on('error', () => resolve());
      return;
    }

    childProcess.kill('SIGTERM');
    childProcess.once('exit', () => resolve());
    childProcess.once('error', () => resolve());
  });
};

const run = async () => {
  const port = await findAvailablePort(defaultPort);
  const serverUrl = `http://127.0.0.1:${port}`;

  const viteProcess = spawnNpm(['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CYPRESS: '1',
      BROWSER: 'none'
    },
    stdio: 'inherit'
  });

  let shuttingDown = false;

  const shutdown = async (exitCode = 0) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    await killProcessTree(viteProcess);
    process.exit(exitCode);
  };

  process.on('SIGINT', () => {
    shutdown(130);
  });

  process.on('SIGTERM', () => {
    shutdown(143);
  });

  try {
    await waitForServer(serverUrl, startupTimeoutMs);

    const cypressExitCode = await new Promise((resolve, reject) => {
      const cypressProcess = spawnNpm(['run', 'e2e:run', '--', ...forwardedArgs], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CYPRESS_BASE_URL: serverUrl.replace('127.0.0.1', 'localhost')
        },
        stdio: 'inherit'
      });

      cypressProcess.on('close', (code) => resolve(code ?? 1));
      cypressProcess.on('error', reject);
    });

    await shutdown(cypressExitCode);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    await shutdown(1);
  }
};

run();