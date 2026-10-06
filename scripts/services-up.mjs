import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

function docker(args, inherit = false) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, {
      stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'inherit'],
    });
    let output = '';
    child.stdout?.on('data', (chunk) => {
      output += chunk;
    });
    child.once('error', () =>
      reject(
        new Error(
          'Unable to start docker; check your container runtime installation',
        ),
      ),
    );
    child.once('exit', (code) => {
      if (code === 0) resolve(output);
      else
        reject(
          new Error(`docker ${args[0]} failed; see the runtime error above`),
        );
    });
  });
}

async function main() {
  // Both Docker Compose and Podman Compose support detached startup.
  await docker(['compose', 'up', '-d'], true);
  const ids = (await docker(['compose', 'ps', '-q']))
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!ids.length)
    throw new Error('Compose started no containers; inspect docker compose ps');
  const deadline = Date.now() + 120000;
  console.info('Waiting for local services to become healthy...');
  while (true) {
    const output = await docker([
      'inspect',
      '--format',
      '{{.Name}} {{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}',
      ...ids,
    ]);
    const states = output
      .trim()
      .split('\n')
      .map((line) => line.trim().split(/\s+/));
    if (
      states.length === ids.length &&
      states.every(
        ([, state, health]) => state === 'running' && health === 'healthy',
      )
    ) {
      console.info('Local services are healthy');
      return;
    }
    if (
      states.some(
        ([, state, health]) =>
          ['exited', 'dead'].includes(state) || health === 'unhealthy',
      )
    ) {
      throw new Error(
        'A local service failed its health check; inspect docker compose ps and docker compose logs',
      );
    }
    if (Date.now() >= deadline)
      throw new Error(
        'Local services did not become healthy within 120 seconds; inspect docker compose ps and docker compose logs',
      );
    await setTimeout(2000);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
