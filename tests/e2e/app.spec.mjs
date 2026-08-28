import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Wellness loads with accessible primary navigation", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page).toHaveTitle(/Wellness 5\.6\.0/);
  await expect(page.locator("main.app")).toBeVisible();
  await expect(page.locator(".navigation-principale .nav-bouton")).toHaveCount(5);
  await expect(
    page.locator('.navigation-principale .nav-bouton[aria-current="page"]'),
  ).toHaveCount(1);
  await expect(page.locator("#w56-legal-card")).toHaveCount(1);
  await expect(page.locator("html")).not.toHaveAttribute("aria-pressed", /.*/);
});

test("light mode works without external Google Fonts", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("wellnessTheme", "light"));
  await page.goto("/index.html");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await page.locator('link[href*="fonts.googleapis.com"]').count()).toBe(0);
});

test("no critical or serious axe violations on the home screen", async ({ page }) => {
  await page.goto("/index.html");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter((item) =>
    ["critical", "serious"].includes(item.impact),
  );
  expect(
    blocking,
    blocking.map((item) => `${item.id}: ${item.help}`).join("\n"),
  ).toEqual([]);
});

test("profile exposes privacy sources and allergy warning", async ({ page }) => {
  await page.goto("/index.html");
  const onboardingSkip = page.locator("#mega-onboarding-skip");
  if (await onboardingSkip.isVisible()) {
    await onboardingSkip.click();
    await expect(page.locator("#mega-onboarding-overlay")).toHaveAttribute("aria-hidden", "true");
  }
  await page.locator('.navigation-principale .nav-bouton[data-page="profil"]').click();
  await expect(page.locator("#w56-legal-card")).toBeVisible();
  await expect(page.locator("#w56-allergy-note")).toContainText(
    "vérifie toujours l’étiquette",
  );
});
