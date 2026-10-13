/** @file Exercise real browser OAuth initiation using fictional provider configuration and intercepted external navigation. */
import { test, expect } from "@playwright/test";

test("Google and Discord buttons create bound authorization requests on the canonical origin", async ({
  page,
}) => {
  const base = new URL(process.env.QA_BASE_URL ?? "http://127.0.0.1:3101");
  const bootstrap = await (await page.request.get("/api/v1/session")).json();
  expect(bootstrap.providers).toEqual({ google: true, discord: true });
  for (const provider of ["google", "discord"] as const) {
    const host = provider === "google" ? "accounts.google.com" : "discord.com";
    await page.route(`https://${host}/**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><title>Fictional provider</title>",
      })
    );

    for (const screen of ["login", "signup"]) {
      await page.goto(`/${screen}`);
      const external = page.waitForRequest(
        (request) => new URL(request.url()).hostname === host
      );

      await page
        .getByRole("button", {
          name: `Continue with ${provider === "google" ? "Google" : "Discord"}`,
        })
        .click();

      const authorization = new URL((await external).url());
      expect(authorization.searchParams.get("redirect_uri")).toBe(
        `${base.origin}/api/auth/${provider}/callback`
      );

      expect(authorization.searchParams.get("response_type")).toBe("code");
      expect(authorization.searchParams.get("scope")).toBe(
        provider === "google" ? "openid profile" : "identify"
      );

      expect(authorization.searchParams.get("state")).toMatch(/^[a-f0-9]{64}$/);
      if (provider === "google") {
        expect(authorization.searchParams.get("nonce")).toMatch(
          /^[a-f0-9]{64}$/
        );

        expect(authorization.searchParams.get("code_challenge_method")).toBe(
          "S256"
        );

        expect(authorization.searchParams.get("code_challenge")).toMatch(
          /^[A-Za-z0-9_-]{43}$/
        );
      }

      const binding = (await page.context().cookies(base.origin)).find(
        (cookie) => cookie.name === "challenge_oauth"
      );

      expect(binding?.value).toMatch(/^[a-f0-9]{64}$/);
      expect(binding?.httpOnly).toBe(true);
      expect(binding?.sameSite).toBe("Lax");
      await page.waitForURL((url) => url.hostname === host);
    }
  }
});
