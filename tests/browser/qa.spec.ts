/**
 * @file Browser acceptance against an isolated running stack. Use only fictional accounts.
 * Requires QA_BASE_URL and TRACKER_TEST_DATABASE_URL. Auth fixtures use real core services;
 * no runtime authentication bypass is installed. Browser artifacts stay outside the repository.
 */
import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createRepository } from "../../packages/db/dist/index.js";
import {
  createAuth,
  createTracker,
  hashPassword,
} from "../../packages/core/dist/index.js";

/** Only a disposable integration database is permitted. */
const url = process.env.TRACKER_TEST_DATABASE_URL;
if (!url || !/_(test|ci)$/.test(new URL(url).pathname))
  throw new Error("Browser tests require an isolated _test or _ci database");
/** Local fixture password; never used outside disposable tests. */
const password = "fictional browser QA password 123";
/** Establish a real account/session and optionally a published recommended season. */
async function fixture(page: Page, admin = false) {
  const db = createRepository(url as string);
  await db.migrate();
  const tracker = createTracker(db.repository),
    auth = createAuth(db.repository, { sendMail: async () => {} });
  const id = await tracker.createUser(admin),
    username = `browser-${randomUUID().slice(0, 16)}`,
    email = `${username}@example.test`;
  await db.repository.transaction(async (tx) => {
    await tx.insert("credentials", {
      id,
      userId: id,
      email,
      passwordHash: await hashPassword(password),
      verified: true,
    });
    const p = await tx.get("profiles", id, true);
    if (!p) throw new Error("Missing fixture profile");
    p.username = username;
    p.provisional = false;
    p.recoveryEmail = email;
    await tx.save("profiles", p);
  });
  const session = await auth.execute({ action: "login", email, password });
  if (!("token" in session) || !session.token || !session.csrf)
    throw new Error("No fixture session");
  await page.context().addCookies([
    {
      name: "challenge_session",
      value: session.token,
      url: process.env.QA_BASE_URL ?? "http://127.0.0.1:3101",
      httpOnly: true,
    },
    {
      name: "challenge_csrf",
      value: session.csrf,
      url: process.env.QA_BASE_URL ?? "http://127.0.0.1:3101",
    },
  ]);
  return { db, tracker, auth, id, username, email, session };
}

test("dedicated authentication, reveal controls, themes and mobile layout", async ({
  page,
}) => {
  await page.goto("/signup");
  await expect(
    page.getByRole("heading", { name: "Start your 101 days" })
  ).toBeVisible();
  await expect(page.getByText("Forgot your password?")).toHaveCount(0);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text"
  );
  await page.getByRole("button", { name: "Hide password" }).click();
  await page.goto("/verify");
  await expect(
    page.getByRole("heading", { name: "Verify your email" })
  ).toBeVisible();
  await expect(page.locator("form")).toHaveCount(0);
  await expect(page.getByText("Forgot your password?")).toHaveCount(0);
  await page.goto("/login");
  await page.getByText("Forgot your password?").click();
  await expect(page).toHaveURL(/\/recover$/);
  await expect(
    page.getByRole("button", { name: "Send recovery link" })
  ).toBeVisible();
  await page.goto(`/login?verify=${"a".repeat(64)}`);
  await expect(page).toHaveURL(/\/verify\?token=/);
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await page.goto("/login?verified=1");
  await expect(page.getByRole("status")).toContainText("Email verified");
  const before = await page
    .getByRole("heading", { name: "Welcome back" })
    .boundingBox();
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  expect(
    await page.getByRole("heading", { name: "Welcome back" }).boundingBox()
  ).toEqual(before);
  await page.getByLabel("Theme", { exact: true }).selectOption("dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.setViewportSize({ width: 320, height: 700 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
    )
    .toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".app-header")
      .evaluate((el) => getComputedStyle(el).transitionDuration)
  ).toBe("0s");
});

test("account menu, provider placeholders, devices, typed deletion and recovery", async ({
  page,
}) => {
  const f = await fixture(page);
  try {
    await page.goto("/home");
    await expect(
      page.getByRole("heading", { name: "Keep showing up." })
    ).toBeVisible();
    await page.getByLabel("Open profile menu").click();
    await page.getByRole("link", { name: "Account settings" }).click();
    await expect(
      page.getByRole("button", { name: "Link google" })
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Link discord" })
    ).toBeDisabled();
    await expect(
      page.getByRole("heading", { name: "Recent sign-ins and devices" })
    ).toBeVisible();
    const deletion = page.getByRole("button", {
      name: "Schedule account deletion",
    });
    await expect(deletion).toBeDisabled();
    await page
      .getByLabel(`Type ${f.username} to confirm deletion`)
      .fill(f.username);
    await deletion.click();
    await page.getByLabel("Current password").fill(password);
    await page.getByRole("button", { name: "Confirm and continue" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel("Email address").fill(f.email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Account deletion scheduled" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Restore my account" }).click();
    await expect(
      page.getByRole("heading", { name: "Keep showing up." })
    ).toBeVisible();
  } finally {
    await f.db.close();
  }
});

test("admin draft editor and participant template, reporting, pause, cancellation and retry", async ({
  page,
}) => {
  const f = await fixture(page, true);
  try {
    const slug = `browser-${randomUUID()}`;
    await page.goto("/admin/seasons");
    await page.getByLabel("Season URL identifier").fill(slug);
    await page
      .getByLabel("Season title", { exact: true })
      .fill("Browser season");
    await page.getByRole("button", { name: "Create draft season" }).click();
    await expect(page).toHaveURL(/\/admin\/seasons\/[a-f0-9-]+$/);
    const details = page.locator("form").filter({
      has: page.getByRole("button", { name: "Save season details" }),
    });
    await details
      .getByLabel("Description", { exact: true })
      .fill("Edited after draft creation");
    await details.getByRole("button", { name: "Save season details" }).click();
    await expect(page.getByRole("status")).toHaveText("Saved.");
    await page
      .getByText("Recommended plan and study sessions", { exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Milestones", exact: true })
    ).toBeVisible();
    await page.getByRole("button", { name: "Add recommended goal" }).click();
    await page.getByLabel("Goal title", { exact: true }).fill("Read a little");
    await page.getByRole("button", { name: "Save recommended plan" }).click();
    await expect(page.getByRole("status")).toHaveText("Saved.");
    await page.getByRole("button", { name: "Publish Browser season" }).click();
    await expect(
      details.getByLabel("URL identifier", { exact: true })
    ).toHaveAttribute("readonly", "");
    await page.goto(`/seasons/${slug}`);
    await page.getByRole("button", { name: "Join", exact: true }).click();
    await expect(page).toHaveURL(/\/setup$/);
    await expect(page.getByLabel("Goal title", { exact: true })).toHaveValue(
      "Read a little"
    );
    await expect(
      page.getByRole("button", { name: "Pause", exact: true })
    ).toHaveCount(0);
    await expect(page.getByText("Previous attempts and logs")).toHaveCount(0);
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Start my challenge" })
    ).toBeDisabled();
    await page.getByRole("button", { name: "Apply season plan" }).click();
    await page.getByRole("button", { name: "Start my challenge" }).click();
    await expect(page).toHaveURL(/\/challenge\//);
    await page
      .getByLabel("Your private report")
      .first()
      .fill("Fictional browser progress");
    await page.getByRole("button", { name: "Submit today’s report" }).click();
    await expect(
      page.getByText("Fictional browser progress", { exact: true })
    ).toBeVisible();
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Resume enrollment" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Resume enrollment" }).click();
    await page.getByLabel(`Type ${slug} to confirm cancellation`).fill(slug);
    await page
      .getByRole("button", { name: "Cancel season", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Resume enrollment" })
    ).toHaveCount(0);
    await page.goto(`/seasons/${slug}`);
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page).toHaveURL(/\/setup$/);
    await expect(page.getByText("Previous attempts and logs")).toHaveCount(0);
    await expect(page.getByLabel("Goal title", { exact: true })).toHaveValue(
      "Read a little"
    );
  } finally {
    await f.db.close();
  }
});

test("signup mail verification and password recovery change pages and credentials", async ({
  page,
  request,
}) => {
  const username = `mail-${randomUUID().slice(0, 16)}`,
    email = `${username}@example.test`;
  const mailbox = process.env.QA_MAILPIT_URL ?? "http://127.0.0.1:8026";
  /** Read only this test's isolated Mailpit message, never a shared or external mailbox. */
  async function link(kind: string) {
    let messageId = "";
    await expect
      .poll(async () => {
        const r = await request.get(`${mailbox}/api/v1/messages`);
        const data = await r.json();
        const message = data.messages?.find(
          (m: { ID: string; To: { Address: string }[]; Subject: string }) =>
            m.To.some((to) => to.Address === email) && m.Subject.includes(kind)
        );
        messageId = message?.ID ?? "";
        return Boolean(messageId);
      })
      .toBe(true);
    const r = await request.get(`${mailbox}/api/v1/message/${messageId}`);
    const data = await r.json();
    const match = String(data.Text).match(/http:\/\/[^\s]+/);
    if (!match) throw new Error("Verification link missing");
    return match[0];
  }
  await page.goto("/signup");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/verify$/);
  await page.goto(await link("Verify"));
  await page.getByRole("button", { name: "Verify my email" }).click();
  await expect(page).toHaveURL(/\/login\?verified=1$/);
  await expect(page.getByRole("status")).toContainText("Email verified");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Keep showing up." })
  ).toBeVisible();
  await page.getByLabel("Open profile menu").click();
  await page.getByRole("button", { name: "Log out" }).click();
  await page.getByText("Forgot your password?").click();
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send recovery link" }).click();
  await expect(page.getByRole("status")).toContainText("recovery link");
  await page.goto(await link("Recover"));
  await page
    .getByLabel("New password", { exact: true })
    .fill(`${password} changed`);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page).toHaveURL(/\/login\?reset=1$/);
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(`${password} changed`);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Keep showing up." })
  ).toBeVisible();
});

test("avatar validation, notification inbox, tips preference and sticky navigation", async ({
  page,
}) => {
  const f = await fixture(page);
  try {
    await page.goto("/account");
    await page.getByLabel("Profile picture").setInputFiles({
      name: "wrong.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not an image"),
    });
    await expect(
      page.getByRole("alert").filter({ hasText: "JPG, PNG or WebP" })
    ).toContainText("JPG, PNG or WebP");
    await page.getByLabel("Profile picture").setInputFiles({
      name: "pixel.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVQImWP4Plnq+2QpBggFADFyBpH6+TmfAAAAAElFTkSuQmCC",
        "base64"
      ),
    });
    await expect(page.locator(".avatar img")).toHaveAttribute(
      "src",
      /^data:image\/webp;base64,/
    );
    await page.getByRole("button", { name: "Remove picture" }).click();
    await expect(page.locator(".avatar img")).toHaveCount(0);
    const noticeId = randomUUID();
    await f.db.repository.transaction((tx) =>
      tx.insert("notifications", {
        id: noticeId,
        userId: f.id,
        message: "Your test milestone is ready",
        href: "/home",
        createdAt: new Date().toISOString(),
        readAt: null,
        dismissedAt: null,
      })
    );
    await page.goto("/notifications");
    await expect(page.getByText("Unread")).toBeVisible();
    await page.getByRole("button", { name: "Mark read" }).click();
    await expect(page.getByText("Unread")).toHaveCount(0);
    await page.getByRole("button", { name: "Dismiss", exact: true }).click();
    await expect(page.getByText("You’re all caught up.")).toBeVisible();
    await page.goto("/home");
    await page.getByLabel("Show hints and tips").uncheck();
    await page.reload();
    await expect(page.getByLabel("Show hints and tips")).not.toBeChecked();
    await page.goto("/account");
    await page.locator("h1").click();
    await page.evaluate(() => scrollTo(0, 500));
    await expect(page.locator(".app-header")).toHaveClass(/nav-hidden/);
    await page.evaluate(() => scrollTo(0, 300));
    await expect(page.locator(".app-header")).not.toHaveClass(/nav-hidden/);
    await page.getByLabel("Open profile menu").click();
    await page.evaluate(() => scrollTo(0, 650));
    await expect(page.locator(".app-header")).not.toHaveClass(/nav-hidden/);
  } finally {
    await f.db.close();
  }
});

test("backdated participation exposes only eligible unoccupied dates and preserves skipped placeholders", async ({
  page,
}) => {
  const f = await fixture(page, true);
  try {
    const { reportingDate } = await import("../../packages/core/dist/index.js");
    const earlier = new Date(Date.now() - 3 * 86400000),
      start = reportingDate(
        new Date(earlier.getTime() + 86400000),
        "Africa/Nairobi"
      );
    const oldTracker = createTracker(f.db.repository, { now: () => earlier });
    const season = await oldTracker.execute(
      f.id,
      {
        command: "CreateSeason",
        title: "Backfill browser season",
        slug: `backfill-${randomUUID()}`,
      },
      randomUUID()
    );
    await oldTracker.execute(
      f.id,
      {
        command: "SaveSeasonTemplate",
        seasonId: season.resourceId,
        expectedSeasonVersion: 0,
        goals: [{ title: "Historical practice", kind: "qualitative" }],
        milestones: [],
      },
      randomUUID()
    );
    await oldTracker.execute(
      f.id,
      {
        command: "PublishSeason",
        seasonId: season.resourceId,
        expectedSeasonVersion: 1,
      },
      randomUUID()
    );
    const enrollment = await f.tracker.execute(
      f.id,
      {
        command: "BackdateEnrollment",
        userId: f.id,
        seasonId: season.resourceId,
        registeredDate: start,
      },
      randomUUID()
    );
    await page.goto(`/challenge/${enrollment.resourceId}`);
    const form = page.locator("form").filter({
      has: page.getByRole("heading", { name: "Fill a skipped date" }),
    });
    await form.getByLabel("Reporting date").selectOption(start);
    await form
      .getByLabel("Your private report")
      .fill("Fictional backfilled report");
    await form.getByRole("button", { name: "Save backdated report" }).click();
    await expect(page.getByRole("status")).toHaveText("Saved.");
    await expect(
      form.getByLabel("Reporting date").locator(`option[value="${start}"]`)
    ).toHaveCount(0);
    const history = (await f.tracker.history(f.id)).find(
      (e) => e.id === enrollment.resourceId
    );
    expect(history?.attempts[0]?.reportingDays).toBe(1);
    await page
      .getByText("Skipped dates (not counted)", { exact: true })
      .click();
    await expect(
      page.getByText("Skipped dates (not counted)", { exact: true })
    ).toBeVisible();
  } finally {
    await f.db.close();
  }
});
