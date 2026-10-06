import assert from 'node:assert/strict';
import test from 'node:test';
import {
  healthResponseSchema,
  parseServerConfig,
} from '../packages/contracts/src/index.js';
import { readiness } from '../packages/core/src/index.js';

test('credential-free local startup keeps providers disabled', () => {
  const config = parseServerConfig({
    GOOGLE_CLIENT_ID: '',
    DISCORD_CLIENT_ID: '',
  });
  assert.equal(config.googleEnabled, false);
  assert.equal(config.discordEnabled, false);
  assert.equal(config.DATABASE_URL, undefined);
});
test('partial or invalid provider configuration fails without disclosing values', () => {
  assert.throws(
    () => parseServerConfig({ GOOGLE_CLIENT_SECRET: 'never-print-this' }),
    { message: 'Incomplete Google configuration' },
  );
  assert.throws(
    () => parseServerConfig({ DATABASE_URL: 'secret-invalid-url' }),
    { message: 'Invalid configuration: DATABASE_URL' },
  );
  assert.throws(() => parseServerConfig({ DISCORD_PUBLIC_KEY: 'not-a-key' }), {
    message: 'Invalid Discord public key',
  });
  assert.throws(() => parseServerConfig({ QUEUE_SCHEMA: 'bad;schema' }));
  assert.throws(() => parseServerConfig({ WORKER_PORT: '0' }));
});
test('complete provider configuration is accepted but does not implement login', () => {
  const config = parseServerConfig({
    GOOGLE_CLIENT_ID: 'fixture-id',
    GOOGLE_CLIENT_SECRET: 'fixture-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/auth/google/callback',
  });
  assert.equal(config.googleEnabled, true);
});
test('readiness distinguishes dependency failure and never exposes its secret', async () => {
  assert.deepEqual(await readiness('web', async () => {}), {
    status: 'ok',
    service: 'web',
  });
  const failed = await readiness('worker', async () => {
    throw new Error('postgres://private');
  });
  assert.deepEqual(healthResponseSchema.parse(failed), {
    status: 'unavailable',
    service: 'worker',
  });
  assert.equal(JSON.stringify(failed).includes('private'), false);
});
