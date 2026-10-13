/** @file Malformed anonymous traffic is rejected before it can wake the shared limiter database. */
import assert from "node:assert/strict";
import test from "node:test";
import { createWebApi } from "../apps/web/server/api.js";
import { createProviders } from "../apps/web/server/providers.js";
import { parseServerConfig } from "../packages/contracts/src/index.js";
import {
  createAuth,
  createTracker,
  DomainError,
  type Repository,
} from "../packages/core/src/index.js";

test("Malformed auth and OAuth inputs do not touch shared storage; valid inputs still use shared limits", async () => {
  let reservations = 0,
    transactions = 0;

  const repository: Repository = {
    transaction: async () => {
      transactions++;
      throw new Error("Unexpected transaction");
    },
  };

  const config = parseServerConfig({});
  const api = createWebApi({
    config,
    auth: createAuth(repository, { sendMail: async () => {} }),
    tracker: createTracker(repository),
    providers: createProviders(config),
    rates: {
      take: async () => {
        reservations++;
        throw new DomainError("RATE_LIMITED");
      },
      allow: async () => false,
    },
  });

  for (const path of ["/api/v1/auth", "/api/v1/oauth"]) {
    const response = await api.handle(
      new Request(`${config.APP_ORIGIN}${path}`, {
        method: "POST",
        headers: { origin: config.APP_ORIGIN },
        body: JSON.stringify({ action: "invalid" }),
      })
    );

    assert.equal(response.status, 400);
  }

  assert.equal(reservations, 0);
  assert.equal(transactions, 0);
  const response = await api.handle(
    new Request(`${config.APP_ORIGIN}/api/v1/auth`, {
      method: "POST",
      headers: { origin: config.APP_ORIGIN },
      body: JSON.stringify({
        action: "login",
        email: "fictional@example.invalid",
        password: "fictional valid password",
      }),
    })
  );

  assert.equal(response.status, 429);
  assert.equal(reservations, 1);
  assert.equal(transactions, 0);
});
