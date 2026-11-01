import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { approveAsBuyer, composeAndSend, startWorkspace } from "./helpers";

/**
 * Axe (WCAG 2.x A/AA rules) on every essential route, in both colour schemes.
 * Automated rules catch a minority of real issues; the manual checks are in
 * docs/acceptance-matrix.md.
 */
async function scan(page: import("@playwright/test").Page, name: string) {
  // A cold dev server may reload the page once after its first compile; let it
  // settle, and retry if the context is replaced mid-scan.
  await page.waitForLoadState("networkidle").catch(() => {});
  let results: Awaited<ReturnType<AxeBuilder["analyze"]>> | undefined;
  for (let attempt = 0; attempt < 3 && !results; attempt++) {
    try {
      results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
    } catch (err) {
      if (attempt === 2 || !/Execution context was destroyed/.test(String(err)))
        throw err;
      await page.waitForLoadState("networkidle").catch(() => {});
    }
  }
  if (!results) throw new Error(`${name}: axe did not run`);
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    serious,
    `${name}: ${serious.map((v) => `${v.id} (${v.nodes.length}): ${v.help}`).join("; ")}`,
  ).toEqual([]);
  return results.violations.map((v) => `${v.impact} ${v.id} ×${v.nodes.length}`);
}

for (const scheme of ["light", "dark"] as const) {
  test(`accessibility scan, ${scheme} scheme`, async ({ page, browser }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const report: Record<string, string[]> = {};
    await page.goto("/");
    report.landing = await scan(page, "landing");
    await page.goto("/app/start");
    report.start = await scan(page, "start");
    await startWorkspace(page, "Axe Runner");
    await page.goto("/app");
    report.listEmpty = await scan(page, "list (empty)");
    await page.goto("/app/new");
    report.compose = await scan(page, "compose");
    const { id, buyerUrl } = await composeAndSend(page, "service");
    await page.goto(`/app/h/${id}`);
    report.detailProposed = await scan(page, "detail (proposed)");
    const ctx = await browser.newContext({ colorScheme: scheme });
    const buyer = await ctx.newPage();
    await buyer.goto(buyerUrl);
    report.buyerProposed = await scan(buyer, "buyer (proposed)");
    await approveAsBuyer(buyer, buyerUrl);
    report.buyerHeld = await scan(buyer, "buyer (held)");
    await page.goto(`/app/h/${id}`);
    report.detailHeld = await scan(page, "detail (held)");
    await page.goto("/app");
    report.list = await scan(page, "list");
    await page.goto("/app/settings");
    report.settings = await scan(page, "settings");
    await page.goto("/does-not-exist");
    report.notFound = await scan(page, "not found");
    await ctx.close();
    console.log(`axe ${scheme}:`, JSON.stringify(report));
  });
}
