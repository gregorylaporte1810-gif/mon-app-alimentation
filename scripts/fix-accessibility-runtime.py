from pathlib import Path

# Real accessibility bug found by axe: <html> carries data-theme-mode, so the
# legacy selector [data-theme-mode] also selected the document root and added
# aria-pressed to it. Limit the pressed-state logic to actual theme buttons.
app_path = Path("app.js")
app = app_path.read_text(encoding="utf-8")
old_selector = 'const boutonsTheme = document.querySelectorAll("[data-theme-mode]");'
new_selector = 'const boutonsTheme = document.querySelectorAll("button[data-theme-mode]");'
if old_selector not in app:
    raise RuntimeError("Theme button selector marker not found.")
app = app.replace(old_selector, new_selector, 1)
app_path.write_text(app, encoding="utf-8")

# The profile navigation test must use the real first-run UI before interacting
# with the bottom navigation. This keeps onboarding behavior covered instead of
# bypassing it with forced clicks or DOM mutation.
test_path = Path("tests/e2e/app.spec.mjs")
test = test_path.read_text(encoding="utf-8")
old_profile = '''test("profile exposes privacy sources and allergy warning", async ({ page }) => {
  await page.goto("/index.html");
  await page.locator('.navigation-principale .nav-bouton[data-page="profil"]').click();
  await expect(page.locator("#w56-legal-card")).toBeVisible();
'''
new_profile = '''test("profile exposes privacy sources and allergy warning", async ({ page }) => {
  await page.goto("/index.html");
  const onboardingSkip = page.locator("#mega-onboarding-skip");
  if (await onboardingSkip.isVisible()) {
    await onboardingSkip.click();
    await expect(page.locator("#mega-onboarding-overlay")).toHaveAttribute("aria-hidden", "true");
  }
  await page.locator('.navigation-principale .nav-bouton[data-page="profil"]').click();
  await expect(page.locator("#w56-legal-card")).toBeVisible();
'''
if old_profile not in test:
    raise RuntimeError("Profile E2E test marker not found.")
test = test.replace(old_profile, new_profile, 1)

# Explicit regression assertion for the bug that axe found.
old_nav_assert = '''  await expect(page.locator("#w56-legal-card")).toHaveCount(1);
});'''
new_nav_assert = '''  await expect(page.locator("#w56-legal-card")).toHaveCount(1);
  await expect(page.locator("html")).not.toHaveAttribute("aria-pressed", /.*/);
});'''
if old_nav_assert not in test:
    raise RuntimeError("Primary navigation test marker not found.")
test = test.replace(old_nav_assert, new_nav_assert, 1)
test_path.write_text(test, encoding="utf-8")

print("✅ Theme ARIA selector fixed and onboarding-aware E2E regression added.")
