/** @file Synthetic cold-start feedback across themes and viewports; no private fixtures are captured. */
import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

test("Slow page reads show accessible waiting feedback in both themes and preserve loading layout", async ({
  page,
}) => {
  const output = process.env.QA_VISUAL_OUTPUT;
  if (output) await mkdir(output, { recursive: true });

  for (const theme of ["light", "dark"]) {
    await page.addInitScript(
      (value) => localStorage.setItem("theme", value),
      theme
    );

    for (const width of [320, 1280]) {
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });

      await page.route("**/api/v1/session", async (route) => {
        await gate;
        await route.fulfill({
          json: { account: null, providers: { google: false, discord: false } },
        });
      });

      try {
        await page.setViewportSize({ width, height: 850 });
        await page.goto("/seasons", { waitUntil: "domcontentloaded" });
        await expect(
          page
            .getByRole("status")
            .filter({ hasText: "service may be waking up" })
        ).toBeVisible();

        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth
          )
        ).toBe(true);

        if (output)
          await page.screenshot({
            path: join(output, `idle-${theme}-${width}.png`),
            fullPage: true,
          });
      } finally {
        release();
        await page.unrouteAll({ behavior: "wait" });
      }

      await expect(
        page.getByText("service may be waking up", { exact: false })
      ).toHaveCount(0);
    }
  }
});

test("Slow authentication retains the form and does not automatically resubmit", async ({
  page,
}) => {
  let submissions = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  await page.route("**/api/v1/auth", async (route) => {
    submissions++;
    await gate;
    await route.fulfill({
      status: 503,
      json: { error: "Service unavailable" },
    });
  });

  await page.goto("/login");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("fictional-idle@example.invalid");

  await page
    .getByLabel("Password", { exact: true })
    .fill("fictional idle password");

  await page.getByRole("button", { name: "Log in", exact: true }).click();
  try {
    await expect(
      page.getByRole("status").filter({ hasText: "service may be waking up" })
    ).toBeVisible();

    expect(submissions).toBe(1);
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
      "fictional idle password"
    );
  } finally {
    release();
  }

  await expect(page.getByRole("alert")).toBeVisible();
  expect(submissions).toBe(1);
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(
    "fictional-idle@example.invalid"
  );
});
