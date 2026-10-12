/** @file Argon2id salts and verifies without exposing plaintext. Registered through the parent suite; uses only fictional fixtures. */
import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "../../packages/core/src/index.js";
import { password } from "./fixtures.js";
test("Argon2id salts and verifies without exposing plaintext", async () => {
  const a = await hashPassword(password),
    b = await hashPassword(password);

  assert.notEqual(a, b);
  assert.equal(await verifyPassword(password, a), true);
  assert.equal(await verifyPassword("wrong password", a), false);
  assert.equal(await verifyPassword(password, "malformed"), false);
  assert.equal(a.includes(password), false);
});
