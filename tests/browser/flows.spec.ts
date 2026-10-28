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

  await page.reload();
  await expect(page.getByText("Hold returned to the buyer")).toBeVisible();
  await buyerContext.close();
});
