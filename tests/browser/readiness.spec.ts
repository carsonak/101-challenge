/** @file Synthetic acceptance for resend, password change, named correction recipients and completion acknowledgement. */
import { test, expect, type Page } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createRepository } from "../../packages/db/dist/index.js";
import {
  createAuth,
  createTracker,
  type AuthMail,
} from "../../packages/core/dist/index.js";

/** Only explicitly disposable data may be used for browser fixtures. */
const url = process.env.TRACKER_TEST_DATABASE_URL;
if (!url || !/_(test|ci)$/.test(new URL(url).pathname))
  throw new Error("Disposable database required");

/** Strong fictional password used only by these fixtures. */
const password = "fictional readiness browser password";

/** Sign in through actual core services; production runtime receives no bypass. */
async function fixture(page: Page, admin = false) {
  const db = createRepository(url as string);
  const mail: AuthMail[] = [];
  const auth = createAuth(db.repository, {
    sendMail: async (message) => {
      mail.push(message);
    },
  });

  const username = `ready-${randomUUID().slice(0, 16)}`,
    email = `${username}@example.invalid`;

  await auth.execute({ action: "signup", username, email, password });
  if (!mail[0]) throw new Error("Missing fixture proof");

  await auth.execute({ action: "verify", token: mail[0].token });
  const login = await auth.execute({ action: "login", email, password });
  if (!("token" in login) || !login.token || !login.csrf)
    throw new Error("Missing fixture login");

  const account = await auth.account(login.token);
  if (admin)
    await db.repository.transaction(async (tx) => {
      const user = await tx.get("users", account.id, true);
      if (!user) throw new Error("Missing fixture user");

      user.admin = true;
      await tx.save("users", user);
    });

  await page.context().addCookies([
    {
      name: "challenge_session",
      value: login.token,
      url: process.env.QA_BASE_URL ?? "http://127.0.0.1:3101",
      httpOnly: true,
    },
    {
      name: "challenge_csrf",
      value: login.csrf,
      url: process.env.QA_BASE_URL ?? "http://127.0.0.1:3101",
    },
  ]);

  return { db, auth, account, username, email, login };
}

/** Capture only fictional affected views and inspectable theme/viewport variants outside Git. */
async function capture(page: Page, label: string) {
  const output = process.env.QA_VISUAL_OUTPUT;
  if (!output) return;

  await mkdir(output, { recursive: true });
  for (const theme of ["light", "dark"]) {
    await page.getByLabel("Theme", { exact: true }).selectOption(theme);
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true);

      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();

        window.scrollTo(0, 0);
      });

      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
      await page.screenshot({
        path: join(output, `readiness-${label}-${theme}-${width}.png`),
        fullPage: true,
      });
    }
  }
}

test("verification resend is discoverable, preserves failures and never exposes account existence", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Resend verification email" }).click();
  await page
    .getByLabel("Email address")
    .fill(`unknown-${randomUUID()}@example.invalid`);

  await page.getByRole("button", { name: "Resend verification email" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "If this address needs verification" })
  ).toBeVisible();

  await page.route("**/api/v1/auth", (route) =>
    route.fulfill({ status: 429, json: { code: "RATE_LIMITED" } })
  );

  await page.getByRole("button", { name: "Resend verification email" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Too many requests" })
  ).toBeVisible();

  await expect(page.getByLabel("Email address")).not.toHaveValue("");
  await capture(page, "resend");
});

test("password change rechecks current proof, signs out and accepts only the new password", async ({
  page,
}) => {
  const f = await fixture(page);
  try {
    await page.goto("/account");
    await page.getByText("Change password", { exact: true }).first().click();
    const form = page.locator("form").filter({
      has: page.getByRole("button", { name: "Change password", exact: true }),
    });

    await form
      .getByLabel("New password", { exact: true })
      .fill(`${password} changed`);

    await form
      .getByRole("button", { name: "Change password", exact: true })
      .click();

    await page.getByLabel("Current password").fill(password);
    await page.getByRole("button", { name: "Confirm and continue" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel("Username or recovery email").fill(f.email);
    await page
      .getByLabel("Password", { exact: true })
      .fill(`${password} changed`);

    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL(/\/home$/);
  } finally {
    await f.db.close();
  }
});

test("correction recipients are explicit and only selected participant metadata is fetched", async ({
  page,
}) => {
  const f = await fixture(page, true);
  try {
    const tracker = createTracker(f.db.repository);
    const season = await tracker.execute(
      f.account.id,
      {
        command: "CreateSeason",
        title: "Recipient practice",
        slug: `recipient-${randomUUID()}`,
      },
      randomUUID()
    );

    await tracker.execute(
      f.account.id,
      {
        command: "PublishSeason",
        seasonId: season.resourceId,
        expectedSeasonVersion: 0,
      },
      randomUUID()
    );

    const enrollment = await tracker.execute(
      f.account.id,
      { command: "Enroll", seasonId: season.resourceId },
      randomUUID()
    );

    const attempt = await tracker.execute(
      f.account.id,
      {
        command: "StartAttempt",
        enrollmentId: enrollment.resourceId,
        expectedEnrollmentVersion: enrollment.version,
        goals: [
          { title: "Private goal must stay private", kind: "qualitative" },
        ],
      },
      randomUUID()
    );

    await tracker.execute(
      f.account.id,
      {
        command: "SubmitReport",
        attemptId: attempt.resourceId,
        expectedAttemptVersion: attempt.version,
        body: "Private report must stay private",
        goalValues: [],
      },
      randomUUID()
    );

    const requests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/v1/admin/stats"))
        requests.push(request.url());
    });

    await page.goto("/admin/corrections");
    await page
      .getByLabel("Find participant by username prefix")
      .fill(f.username);

    await page.getByRole("button", { name: "Search participants" }).click();
    await expect(
      page.getByLabel("Participant", { exact: true }).locator("option")
    ).toHaveCount(2);

    expect(requests).toEqual([]);
    const details = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/v1/admin/stats?`) &&
        response.url().includes(`participantId=${f.account.id}`)
    );

    await page
      .getByLabel("Participant", { exact: true })
      .selectOption(f.account.id);

    const data = await (await details).json();
    expect(JSON.stringify(data)).not.toMatch(
      /Private report|Private goal|Seed|passwordHash|tokenHash/
    );

    await page
      .getByLabel("Attempt", { exact: true })
      .selectOption(attempt.resourceId);

    const report = data.reports[0];
    await page.getByLabel("Report", { exact: true }).selectOption(report.id);
    const issue = page.getByRole("button", {
      name: "Issue correction key",
      exact: true,
    });

    await expect(issue).toBeDisabled();
    await page
      .getByLabel(
        `I confirm this key is for ${f.username} and the selected report.`
      )
      .check();

    await expect(issue).toBeEnabled();
    await issue.click();
    await expect(page.locator("output")).toHaveText(/^[a-f0-9]{64}$/);
    await expect(
      page.getByText(`Key for ${f.username}.`, { exact: false })
    ).toBeVisible();

    expect(
      requests.every((request) =>
        request.includes(`participantId=${f.account.id}`)
      )
    ).toBe(true);

    await capture(page, "corrections");
  } finally {
    await f.db.close();
  }
});

test("completion remains on Home and setup names its reporting timezone", async ({
  page,
}) => {
  const f = await fixture(page, true);
  let instant = new Date(Date.now() - 102 * 86400000);
  const tracker = createTracker(f.db.repository, { now: () => instant });
  try {
    const season = await tracker.execute(
      f.account.id,
      {
        command: "CreateSeason",
        title: "A completed practice",
        slug: `complete-${randomUUID()}`,
      },
      randomUUID()
    );

    await tracker.execute(
      f.account.id,
      {
        command: "PublishSeason",
        seasonId: season.resourceId,
        expectedSeasonVersion: 0,
      },
      randomUUID()
    );

    const enrollment = await tracker.execute(
      f.account.id,
      { command: "Enroll", seasonId: season.resourceId },
      randomUUID()
    );

    await page.goto(`/seasons/${season.resourceId}/setup`);
    await expect(
      page.getByText("Your reporting days follow", { exact: false })
    ).toContainText("Africa/Nairobi");

    await capture(page, "setup");
    const attempt = await tracker.execute(
      f.account.id,
      {
        command: "StartAttempt",
        enrollmentId: enrollment.resourceId,
        expectedEnrollmentVersion: enrollment.version,
        goals: [{ title: "Fictional completion", kind: "qualitative" }],
      },
      randomUUID()
    );

    for (let day = 0; day < 101; day++) {
      await tracker.execute(
        f.account.id,
        {
          command: "SubmitReport",
          attemptId: attempt.resourceId,
          expectedAttemptVersion: day,
          body: "Fictional completed practice",
          goalValues: [],
        },
        randomUUID()
      );

      instant = new Date(instant.getTime() + 86400000);
    }

    await page.goto("/home");
    await expect(
      page.getByRole("heading", { name: "Completed seasons" })
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: "A completed practice" })
    ).toHaveAttribute("href", `/challenge/${enrollment.resourceId}`);

    await capture(page, "completion");
  } finally {
    await f.db.close();
  }
});

test("provider-only owners can set a password without an email", async ({
  page,
}) => {
  const f = await fixture(page);
  try {
    const browser = randomBytes(32).toString("hex");
    const begin = await f.auth.beginOAuth("discord", browser);
    const state = await f.auth.oauthState("discord", begin.state, browser);
    const login = await f.auth.completeOAuth(state.id, browser, {
      provider: "discord",
      subject: randomUUID(),
      username: `provider-${randomUUID().slice(0, 15)}`,
    });

    const account = await f.auth.account(login.token);
    await page.context().addCookies([
      {
        name: "challenge_session",
        value: login.token,
        url: process.env.QA_BASE_URL ?? "http://127.0.0.1:3101",
        httpOnly: true,
      },
      {
        name: "challenge_csrf",
        value: login.csrf,
        url: process.env.QA_BASE_URL ?? "http://127.0.0.1:3101",
      },
    ]);

    await page.goto("/account");
    await expect(
      page.getByText("No password set.", { exact: false })
    ).toBeVisible();

    await expect(
      page.getByText("Recommended: verify a recovery email", { exact: false })
    ).toBeVisible();

    await capture(page, "provider-account");
    await page.getByText("Set password", { exact: true }).first().click();
    await page.getByLabel("New password", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Set password", exact: true })
      .click();

    await expect(page.getByLabel("Current password")).toHaveCount(0);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel("Username or recovery email").fill(account.username);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL(/\/home$/);
  } finally {
    await f.db.close();
  }
});

test("signup without recovery email logs in and always recommends recovery in settings", async ({
  page,
}) => {
  const username = `optional-${randomUUID().slice(0, 16)}`;
  await page.goto("/signup");
  const usernameField = page.getByLabel("Username", { exact: true });
  await usernameField.fill("has space");
  expect(
    await usernameField.evaluate(
      (input: HTMLInputElement) => input.validity.patternMismatch
    )
  ).toBe(true);

  await usernameField.fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await capture(page, "optional-signup");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();

  await expect(page).toHaveURL(/\/account$/);
  await expect(
    page.getByText("Recommended: verify a recovery email", { exact: false })
  ).toBeVisible();

  await capture(page, "password-account");
  await page.reload();
  await expect(
    page.getByText("Recommended: verify a recovery email", { exact: false })
  ).toBeVisible();
});

test("Google signup requires choosing a username before tracker use", async ({
  page,
}) => {
  const f = await fixture(page);
  try {
    const browser = randomBytes(32).toString("hex"),
      address = `google-${randomUUID()}@example.invalid`;

    const begin = await f.auth.beginOAuth("google", browser),
      state = await f.auth.oauthState("google", begin.state, browser);

    const login = await f.auth.completeOAuth(state.id, browser, {
      provider: "google",
      subject: randomUUID(),
      recoveryEmail: address,
    });

    await page.context().addCookies([
      {
        name: "challenge_session",
        value: login.token,
        url: process.env.QA_BASE_URL ?? "http://127.0.0.1:3101",
        httpOnly: true,
      },
      {
        name: "challenge_csrf",
        value: login.csrf,
        url: process.env.QA_BASE_URL ?? "http://127.0.0.1:3101",
      },
    ]);

    await page.goto("/home");
    await expect(page).toHaveURL(/\/account$/);
    await expect(
      page.getByText("Choose a username to finish signing up.", {
        exact: false,
      })
    ).toBeVisible();

    const forbidden = await page.request.post("/api/v1/command", {
      headers: { "x-csrf-token": login.csrf, "idempotency-key": randomUUID() },
      data: { command: "Enroll", seasonId: randomUUID() },
    });

    expect(forbidden.status()).toBe(403);
    await expect(page.getByText(address, { exact: true })).toBeVisible();
    await capture(page, "google-onboarding");
    await page
      .getByLabel("Username", { exact: true })
      .fill(`google-${randomUUID()}`.slice(0, 40));

    await page
      .getByRole("button", { name: "Save username", exact: true })
      .click();

    await expect(
      page.getByText("Choose a username to finish signing up.", {
        exact: false,
      })
    ).toHaveCount(0);
  } finally {
    await f.db.close();
  }
});
