import { test, expect } from "@playwright/test";
import {
  approveAsBuyer,
  composeAndSend,
  pngFixture,
  startWorkspace,
  uploadFiles,
} from "./helpers";

test.describe.configure({ mode: "serial" });

test("Flow A: service deliverable passes the checks and the buyer releases", async ({
  page,
  browser,
}) => {
  await startWorkspace(page);
  const { id, buyerUrl } = await composeAndSend(page, "service");

  const buyerContext = await browser.newContext();
  const buyer = await buyerContext.newPage();
  await approveAsBuyer(buyer, buyerUrl);

  await page.goto("/app");
  await expect(page.getByText(/hold valid \d+ d/)).toBeVisible();

  await page.goto(`/app/h/${id}`);
  await expect(page.getByText("Held", { exact: true }).first()).toBeVisible();
  await uploadFiles(page, [
    { name: "concept-a.png", buffer: pngFixture(1200, 900, 300, 0) },
    { name: "concept-b.png", buffer: pngFixture(1200, 900, 300, 60) },
    { name: "concept-c.png", buffer: pngFixture(1400, 900, 300, 120) },
  ]);
  await page
    .getByPlaceholder(/Anything the buyer should know/)
    .fill("Three concepts attached. B is my favourite.");
  await page.getByRole("button", { name: "Submit for checks" }).click();
  await expect(page.getByText(/Buyer window|Checking/).first()).toBeVisible();
  await expect(page.getByText("Buyer window").first()).toBeVisible({ timeout: 90_000 });

  await buyer.reload();
  await expect(buyer.getByText("3 matching files")).toBeVisible();
  await buyer.getByRole("button", { name: "Confirm and release" }).click();
  await buyer.getByRole("button", { name: "Release now" }).click();
  await expect(buyer.getByText("Released", { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText("$420.00 released to you")).toBeVisible();
  await expect(page.getByText(/PayPal captured \$420\.00/)).toBeVisible();

  // The list shows the outcome and how long it took.
  await page.goto("/app");
  await expect(page.getByText(/Released \$420\.00 · .* from submission/)).toBeVisible();
  await expect(page.getByText(/typical time from submission to release/)).toBeVisible();

  // The next proofhold starts from this one's test.
  await page.goto(`/app/h/${id}`);
  await page.getByRole("link", { name: "Start another from this test" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/new\\?from=${id}`));
  await expect(page.getByLabel("Title")).toHaveValue("Logo concepts for Driftwood Café");
  await expect(page.getByRole("heading", { name: "The acceptance test" })).toBeVisible();
  await expect(page.getByText(/Reused from “Logo concepts/)).toBeVisible();
  await buyerContext.close();
});

test("Flow B: goods ship with tracking and the buyer confirms receipt", async ({
  page,
  browser,
}) => {
  await startWorkspace(page, "Sam Lee");
  const { id, buyerUrl } = await composeAndSend(page, "goods");
  const buyerContext = await browser.newContext();
  const buyer = await buyerContext.newPage();
  await approveAsBuyer(buyer, buyerUrl);

  await page.goto(`/app/h/${id}`);
  await page.getByLabel("Carrier").selectOption("UPS");
  await page.getByLabel("Tracking number").fill("1Z999AA10123456784");
  await page.getByRole("button", { name: "Record" }).click();
  await expect(page.getByText("UPS 1Z999AA10123456784", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Submit for checks" }).click();
  await expect(page.getByText("Buyer window").first()).toBeVisible({ timeout: 60_000 });

  await buyer.reload();
  await expect(buyer.getByText(/UPS 1Z999AA10123456784 recorded/)).toBeVisible();
  await buyer.getByRole("button", { name: "Confirm and release" }).click();
  await buyer.getByRole("button", { name: "Release now" }).click();
  await expect(buyer.getByText("Released", { exact: true }).first()).toBeVisible();
  await buyerContext.close();
});

test("Flow C: a thin delivery is blocked, the buyer objects, declines the offer, and the hold is returned", async ({
  page,
  browser,
}) => {
  await startWorkspace(page, "Noor Haddad");
  const { id, buyerUrl } = await composeAndSend(page, "service");
  const buyerContext = await browser.newContext();
  const buyer = await buyerContext.newPage();
  await approveAsBuyer(buyer, buyerUrl);

  await page.goto(`/app/h/${id}`);
  await uploadFiles(page, [{ name: "sketch.png", buffer: pngFixture(300, 200, 72) }]);
  await page.getByRole("button", { name: "Submit for checks" }).click();
  await expect(page.getByText("Buyer window").first()).toBeVisible({ timeout: 90_000 });

  await buyer.reload();
  await buyer.getByRole("button", { name: "Object" }).click();
  await buyer
    .getByLabel("Reason")
    .fill("Only one small sketch; we agreed three concepts.");
  await buyer.getByRole("button", { name: "Send objection" }).click();
  await expect(buyer.getByText("In review", { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(
    page.locator("blockquote", { hasText: "Only one small sketch" }),
  ).toBeVisible();
  await page.getByLabel("Propose a partial release").fill("100");
  await page.getByLabel("Why this amount").fill("For the one concept delivered.");
  await page.getByRole("button", { name: "Send offer" }).click();
  await expect(page.getByText("You offered")).toBeVisible();

  await buyer.reload();
  await expect(buyer.getByText("The seller made an offer")).toBeVisible();
  await buyer.getByRole("button", { name: "Decline", exact: true }).click();
  await buyer.getByRole("button", { name: "Decline and take the hold back" }).click();
  await expect(buyer.getByText("Voided", { exact: true }).first()).toBeVisible();

  await expect(buyer.getByText("Nothing was charged.")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Hold returned to the buyer")).toBeVisible();
  await expect(page.getByText("The hold went back to the buyer.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "start another from this test", exact: true }),
  ).toBeVisible();
  await buyerContext.close();
});

test("Flow D: after release, a PayPal dispute is opened, the evidence bundle is filed, and adjudication closes it", async ({
  page,
  browser,
}) => {
  await startWorkspace(page, "Ivy Chen");
  const { id, buyerUrl } = await composeAndSend(page, "service");
  const buyerContext = await browser.newContext();
  const buyer = await buyerContext.newPage();
  await approveAsBuyer(buyer, buyerUrl);

  await page.goto(`/app/h/${id}`);
  await uploadFiles(page, [
    { name: "final.png", buffer: pngFixture(1200, 900, 300, 30) },
  ]);
  await page.getByRole("button", { name: "Submit for checks" }).click();
  await expect(page.getByText("Buyer window").first()).toBeVisible({ timeout: 90_000 });

  await buyer.reload();
  await buyer.getByRole("button", { name: "Confirm and release" }).click();
  await buyer.getByRole("button", { name: "Release now" }).click();
  await expect(buyer.getByText("Released", { exact: true }).first()).toBeVisible();

  await buyer.getByRole("button", { name: "Open a PayPal dispute" }).click();
  await buyer.getByRole("button", { name: "Open dispute" }).click();
  await expect(buyer.getByText("Disputed", { exact: true }).first()).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "File evidence with PayPal" }).click();
  await expect(page.getByText("Evidence bundle filed with PayPal")).toBeVisible();
  await page.getByRole("button", { name: "Simulate: seller wins" }).click();
  await expect(page.getByText("Released", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Dispute resolved: seller favour/i)).toBeVisible();
  await buyerContext.close();
});
