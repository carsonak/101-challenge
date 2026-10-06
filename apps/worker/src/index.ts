import { createServer } from 'node:http';
import { parseServerConfig } from '@challenge/contracts';
import { readiness } from '@challenge/core';
import { createDatabase } from '@challenge/db';
import { PgBoss } from 'pg-boss';

async function main() {
  const config = parseServerConfig(process.env);
  const database = config.DATABASE_URL
    ? createDatabase(config.DATABASE_URL)
    : undefined;
  const boss = config.DATABASE_URL
    ? new PgBoss({
        connectionString: config.DATABASE_URL,
        schema: config.QUEUE_SCHEMA,
      })
    : undefined;
  boss?.on('error', () => console.error('Worker queue unavailable'));
  // Startup initializes only pg-boss infrastructure. Domain handlers follow F1/F2.
  try {
    await boss?.start();
  } catch {
    await database?.close();
    await boss?.stop();
    throw new Error('Worker queue startup failed');
  }
  const server = createServer(async (request, response) => {
    if (
      request.method !== 'GET' ||
      !['/health', '/ready'].includes(request.url ?? '')
    ) {
      response.writeHead(404).end();
      return;
    }
    const result =
      request.url === '/health'
        ? { status: 'ok', service: 'worker' }
        : await readiness('worker', async () => {
            if (!database || !boss) throw new Error('Database not configured');
            await database.probe();
          });
    response.writeHead(result.status === 'ok' ? 200 : 503, {
      'content-type': 'application/json',
    });
    response.end(JSON.stringify(result));
  });
  server.listen(config.WORKER_PORT, config.WORKER_HOST, () =>
    console.info('Worker listening'),
  );
  let stopping = false;
  async function shutdown() {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 10000).unref();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await boss?.stop();
    await database?.close();
    clearTimeout(deadline);
  }
  process.once('SIGTERM', () => {
    void shutdown();
  });
  process.once('SIGINT', () => {
    void shutdown();
  });
  server.once('error', () => {
    console.error('Worker listener failed');
    void shutdown().then(() => {
      process.exitCode = 1;
    });
  });
}

main().catch(() => {
  console.error(
    'Worker startup failed; check server configuration and database availability',
  );
  process.exitCode = 1;
});
