const { test, expect } = require("@playwright/test");
const path = require("path");

const VALID_IMAGE = path.resolve(
	__dirname,
	"..",
	"image",
	"tiles_puzzle_4x4_tile_map.jpg",
);
const ALT_PNG_1X1 = Buffer.from(
"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7ZQWQAAAAASUVORK5CYII=",
"base64",
);

/** Open the Options view via the side-panel navigation. */
async function openOptions(page) {
await page.locator("#btn-menu").click();
await page.locator("#nav-options").click();
}

/** Return to the game view by pressing the OK button inside Options. */
async function closeOptions(page) {
await page.locator("#btn-options-ok").click();
}

async function seedTodayBestScores(
page,
{ best3, best4, allTime3, allTime4, gridSize },
) {
await page.evaluate(
({ best3, best4, allTime3, allTime4, gridSize }) => {
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, "0");
const day = String(now.getDate()).padStart(2, "0");
const date = `${year}-${month}-${day}`;

if (best3 !== undefined)
localStorage.setItem(`puzzle15_best_3x3_${date}`, `${best3}`);
if (best4 !== undefined)
localStorage.setItem(`puzzle15_best_4x4_${date}`, `${best4}`);
if (allTime3 !== undefined)
localStorage.setItem("puzzle15_bestMoves_3x3", `${allTime3}`);
if (allTime4 !== undefined)
localStorage.setItem("puzzle15_bestMoves_4x4", `${allTime4}`);
if (gridSize !== undefined)
localStorage.setItem("puzzle15_gridSize", `${gridSize}`);
},
{ best3, best4, allTime3, allTime4, gridSize },
);
}

async function expectTodayBestForGrid(page, gridSize, expected) {
await openOptions(page);
await page.locator(`#view-options [data-size="${gridSize}"]`).click();
await closeOptions(page);
await expect(page.locator("#bestMovesToday")).toHaveText(
`Today: ${expected}`,
);
}

async function getHorizontalOverflow(page) {
return page.evaluate(() => {
const html = document.documentElement;
const body = document.body;
const epsilon = 1;

return {
htmlOverflow: html.scrollWidth - html.clientWidth > epsilon,
bodyOverflow: body.scrollWidth - body.clientWidth > epsilon,
htmlScrollWidth: html.scrollWidth,
htmlClientWidth: html.clientWidth,
bodyScrollWidth: body.scrollWidth,
bodyClientWidth: body.clientWidth,
};
});
}

async function expectNoHorizontalOverflow(page) {
const overflow = await getHorizontalOverflow(page);
expect(
overflow.htmlOverflow,
`HTML overflow: ${JSON.stringify(overflow)}`,
).toBe(false);
expect(
overflow.bodyOverflow,
`Body overflow: ${JSON.stringify(overflow)}`,
).toBe(false);
}

test.describe("Tiles Puzzle smoke tests", () => {
test.beforeEach(async ({ page }) => {
await page.goto("/index.html");
});

test("loads page and starts game after valid image upload", async ({
page,
}) => {
const imageInput = page.locator("#imageInput");
await imageInput.setInputFiles(VALID_IMAGE);

await expect(page.locator("#status")).toContainText("Game active!");
await expect(page.locator("#moves")).toHaveText("Moves: 0");

const tiles = page.locator("#puzzle .tile");
await expect(tiles).toHaveCount(16);
await expect(page.locator("#resetBtn")).toBeEnabled();
});

test("keyboard controls move and reshuffle", async ({ page }) => {
await page.locator("#imageInput").setInputFiles(VALID_IMAGE);

await expect(page.locator("#moves")).toHaveText("Moves: 0");

const movementKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
for (const key of movementKeys) {
await page.keyboard.press(key);
const moved = (await page.locator("#moves").textContent()) === "Moves: 1";
if (moved) break;
}

await expect(page.locator("#moves")).toHaveText("Moves: 1");

await page.keyboard.press("r");
await expect(page.locator("#moves")).toHaveText("Moves: 0");
await expect(page.locator("#status")).toContainText("Puzzle shuffled!");
});

test("Shift+Arrow shifts a whole line in one move", async ({ page }) => {
await page.locator("#imageInput").setInputFiles(VALID_IMAGE);

const scenario = await page.evaluate(() => {
const puzzle = document.getElementById("puzzle");
const raw = puzzle?.dataset.boardSignature;
if (!raw) return null;

const signature = raw
.split(",")
.map((value) => Number.parseInt(value, 10));
const totalTiles = signature.length;
const gridSize = Math.sqrt(totalTiles);
const emptyIndex = signature.indexOf(totalTiles - 1);
if (emptyIndex < 0) return null;

const row = Math.floor(emptyIndex / gridSize);
const col = emptyIndex % gridSize;
if (row < gridSize - 1) {
return {
key: "Shift+ArrowUp",
target: (gridSize - 1) * gridSize + col,
};
}
if (row > 0) {
return { key: "Shift+ArrowDown", target: col };
}
if (col < gridSize - 1) {
return {
key: "Shift+ArrowLeft",
target: row * gridSize + (gridSize - 1),
};
}
if (col > 0) {
return { key: "Shift+ArrowRight", target: row * gridSize };
}

return null;
});

expect(
scenario,
"Expected a valid Shift+Arrow line shift scenario",
).not.toBeNull();

await expect(page.locator("#moves")).toHaveText("Moves: 0");
await page.keyboard.press(scenario.key);
await expect(page.locator("#moves")).toHaveText("Moves: 1");

const newEmptyIndex = await page.evaluate(() => {
const puzzle = document.getElementById("puzzle");
const raw = puzzle?.dataset.boardSignature;
if (!raw) return -1;
const signature = raw
.split(",")
.map((value) => Number.parseInt(value, 10));
return signature.indexOf(signature.length - 1);
});

expect(newEmptyIndex).toBe(scenario.target);
});

test("Shift+WASD shifts a whole line in one move", async ({ page }) => {
await page.locator("#imageInput").setInputFiles(VALID_IMAGE);

const scenario = await page.evaluate(() => {
const puzzle = document.getElementById("puzzle");
const raw = puzzle?.dataset.boardSignature;
if (!raw) return null;

const signature = raw
.split(",")
.map((value) => Number.parseInt(value, 10));
const totalTiles = signature.length;
const gridSize = Math.sqrt(totalTiles);
const emptyIndex = signature.indexOf(totalTiles - 1);
if (emptyIndex < 0) return null;

const row = Math.floor(emptyIndex / gridSize);
const col = emptyIndex % gridSize;
if (row < gridSize - 1) {
return {
key: "Shift+W",
target: (gridSize - 1) * gridSize + col,
};
}
if (row > 0) {
return { key: "Shift+S", target: col };
}
if (col < gridSize - 1) {
return {
key: "Shift+A",
target: row * gridSize + (gridSize - 1),
};
}
if (col > 0) {
return { key: "Shift+D", target: row * gridSize };
}

return null;
});

expect(
scenario,
"Expected a valid Shift+WASD line shift scenario",
).not.toBeNull();

await expect(page.locator("#moves")).toHaveText("Moves: 0");
await page.keyboard.press(scenario.key);
await expect(page.locator("#moves")).toHaveText("Moves: 1");

const newEmptyIndex = await page.evaluate(() => {
const puzzle = document.getElementById("puzzle");
const raw = puzzle?.dataset.boardSignature;
if (!raw) return -1;
const signature = raw
.split(",")
.map((value) => Number.parseInt(value, 10));
return signature.indexOf(signature.length - 1);
});

expect(newEmptyIndex).toBe(scenario.target);
});

test("question-mark shortcut shows keyboard help", async ({ page }) => {
await page.keyboard.press("?");
await expect(page.locator("#status")).toContainText(
"Shortcuts: Arrow keys/WASD move, Shift+Arrow/Shift+WASD shifts a whole line, R reshuffles, ? shows this help.",
);
});

test("number toggle persists across reloads", async ({ page }) => {
await openOptions(page);
await page.locator("#numberToggleBtn").click();
await expect(page.locator("#numberToggleBtn")).toHaveClass(/active/);
await closeOptions(page);

await page.reload();
await openOptions(page);
await expect(page.locator("#numberToggleBtn")).toHaveClass(/active/);
await closeOptions(page);

await page.locator("#imageInput").setInputFiles(VALID_IMAGE);
await expect(page.locator("#puzzle .tile-number").first()).toBeVisible();
});

test("status region has live announcement attributes", async ({ page }) => {
const status = page.locator("#status");
await expect(status).toHaveAttribute("role", "status");
await expect(status).toHaveAttribute("aria-live", "polite");
await expect(status).toHaveAttribute("aria-atomic", "true");
});

test("toggle and difficulty buttons expose aria-pressed state", async ({
page,
}) => {
await openOptions(page);

const numberToggle = page.locator("#numberToggleBtn");
await expect(numberToggle).toHaveAttribute("aria-pressed", "false");
await numberToggle.click();
await expect(numberToggle).toHaveAttribute("aria-pressed", "true");

const diff3 = page.locator('#view-options [data-size="3"]');
const diff4 = page.locator('#view-options [data-size="4"]');
await expect(diff4).toHaveAttribute("aria-pressed", "true");
await expect(diff3).toHaveAttribute("aria-pressed", "false");

await diff3.click();
await expect(diff3).toHaveAttribute("aria-pressed", "true");
await expect(diff4).toHaveAttribute("aria-pressed", "false");

await closeOptions(page);
});

test("invalid file type shows friendly error", async ({ page }) => {
await page.locator("#imageInput").setInputFiles({
name: "not-image.txt",
mimeType: "text/plain",
buffer: Buffer.from("plain text"),
});

await expect(page.locator("#status")).toContainText(
"Unsupported image type",
);
await expect(page.locator("#resetBtn")).toBeDisabled();
});

test("difficulty switch changes grid size and page title", async ({
page,
}) => {
await openOptions(page);

// Start with default 4x4
await expect(page.locator('#view-options [data-size="4"]')).toHaveClass(/active/);
await closeOptions(page);
await expect(page.locator("#gameTitle")).toContainText("15-Puzzle");

// Load image, confirm 16 tiles
await page.locator("#imageInput").setInputFiles(VALID_IMAGE);
await expect(page.locator("#puzzle .tile")).toHaveCount(16);

// Switch to 3x3
await openOptions(page);
await page.locator('#view-options [data-size="3"]').click();
await expect(page.locator('#view-options [data-size="3"]')).toHaveClass(/active/);
await expect(page.locator('#view-options [data-size="4"]')).not.toHaveClass(/active/);
await closeOptions(page);
await expect(page.locator("#gameTitle")).toContainText("8-Puzzle");
await expect(page.locator("#puzzle .tile")).toHaveCount(9);

// Switch to 5x5
await openOptions(page);
await page.locator('#view-options [data-size="5"]').click();
await closeOptions(page);
await expect(page.locator("#gameTitle")).toContainText("24-Puzzle");
await expect(page.locator("#puzzle .tile")).toHaveCount(25);
});

test("click movement works after switching to 3x3", async ({ page }) => {
await openOptions(page);
await page.locator('#view-options [data-size="3"]').click();
await closeOptions(page);
await page.locator("#imageInput").setInputFiles(VALID_IMAGE);

await expect(page.locator("#moves")).toHaveText("Moves: 0");
await page.locator("#puzzle .tile.movable").first().click();
await expect(page.locator("#moves")).toHaveText("Moves: 1");
});

test("clicking a non-adjacent tile in same row/column shifts a whole tile line", async ({
page,
}) => {
await page.locator("#imageInput").setInputFiles(VALID_IMAGE);

let target = null;
let distance = 0;

for (let attempt = 0; attempt < 4; attempt++) {
const candidate = await page.evaluate(() => {
const puzzle = document.getElementById("puzzle");
const raw = puzzle?.dataset.boardSignature;
if (!raw) return null;

const signature = raw
.split(",")
.map((value) => Number.parseInt(value, 10));
const totalTiles = signature.length;
const gridSize = Math.sqrt(totalTiles);
const emptyIndex = signature.indexOf(totalTiles - 1);
if (emptyIndex < 0) return null;

const emptyRow = Math.floor(emptyIndex / gridSize);
const emptyCol = emptyIndex % gridSize;

for (let index = 0; index < totalTiles; index++) {
if (index === emptyIndex) continue;
const row = Math.floor(index / gridSize);
const col = index % gridSize;
if (row === emptyRow) {
const rowDistance = Math.abs(index - emptyIndex);
if (rowDistance > 1) {
return { target: index, distance: rowDistance };
}
}
if (col === emptyCol) {
const colDistance = Math.abs(index - emptyIndex) / gridSize;
if (colDistance > 1) {
return { target: index, distance: colDistance };
}
}
}

return null;
});

if (candidate) {
target = candidate.target;
distance = candidate.distance;
break;
}

await page.locator("#resetBtn").click();
await expect(page.locator("#status")).toContainText("Puzzle shuffled!");
}

expect(
target,
"Expected a non-adjacent line move candidate",
).not.toBeNull();
expect(
distance,
"Expected move distance to be greater than 1",
).toBeGreaterThan(1);

await expect(page.locator("#moves")).toHaveText("Moves: 0");
await page.locator(`#puzzle .tile:nth-child(${target + 1})`).click();
await expect(page.locator("#moves")).toHaveText("Moves: 1");

const newEmptyIndex = await page.evaluate(() => {
const puzzle = document.getElementById("puzzle");
const raw = puzzle?.dataset.boardSignature;
if (!raw) return -1;
const signature = raw
.split(",")
.map((value) => Number.parseInt(value, 10));
return signature.indexOf(signature.length - 1);
});

expect(newEmptyIndex).toBe(target);
});

test("difficulty persists across reloads", async ({ page }) => {
await openOptions(page);
await page.locator('#view-options [data-size="3"]').click();
await closeOptions(page);

await page.reload();
await openOptions(page);
await expect(page.locator('#view-options [data-size="3"]')).toHaveClass(/active/);
await closeOptions(page);
await expect(page.locator("#gameTitle")).toContainText("8-Puzzle");

// Clean up: reset to 4x4 so other tests start fresh
await openOptions(page);
await page.locator('#view-options [data-size="4"]').click();
await closeOptions(page);
});

test("reset settings restores defaults", async ({ page }) => {
await openOptions(page);
await page.locator('#view-options [data-size="3"]').click();
await page.locator("#numberToggleBtn").click();

page.once("dialog", (dialog) => dialog.accept());
await page.locator("#resetSettingsBtn").click();

await expect(page.locator('#view-options [data-size="4"]')).toHaveClass(/active/);
await expect(page.locator('#view-options [data-size="4"]')).toHaveAttribute(
"aria-pressed",
"true",
);
await expect(page.locator('#view-options [data-size="3"]')).toHaveAttribute(
"aria-pressed",
"false",
);
await expect(page.locator("#numberToggleBtn")).toHaveAttribute(
"aria-pressed",
"false",
);
await expect(page.locator("#numberToggleBtn")).not.toHaveClass(/active/);

await closeOptions(page);
});

test("new image upload does not alter existing best scores", async ({
page,
}) => {
await seedTodayBestScores(page, {
best3: 11,
best4: 22,
allTime3: 10,
allTime4: 20,
gridSize: 4,
});
await page.reload();

await expect(page.locator("#bestMovesToday")).toHaveText("Today: 22");
await expect(page.locator("#bestMovesAllTime")).toHaveText("All time: 20");

await page.locator("#imageInput").setInputFiles(VALID_IMAGE);
await expect(page.locator("#bestMovesToday")).toHaveText("Today: 22");
await expect(page.locator("#bestMovesAllTime")).toHaveText("All time: 20");

await page.locator("#imageInput").setInputFiles({
name: "tiny-alt.png",
mimeType: "image/png",
buffer: ALT_PNG_1X1,
});

await expect(page.locator("#bestMovesToday")).toHaveText("Today: 22");
await expect(page.locator("#bestMovesAllTime")).toHaveText("All time: 20");
});

test("seeded shuffle is deterministic across reloads", async ({ page }) => {
await page.goto("/index.html?seed=deterministic-check");
await page.locator("#imageInput").setInputFiles(VALID_IMAGE);
await expect(page.locator("#status")).toContainText("Game active!");
const signatureA = await page
.locator("#puzzle")
.getAttribute("data-board-signature");

await page.reload();
await page.locator("#imageInput").setInputFiles(VALID_IMAGE);
await expect(page.locator("#status")).toContainText("Game active!");
const signatureB = await page
.locator("#puzzle")
.getAttribute("data-board-signature");

expect(signatureA).toBeTruthy();
expect(signatureA).toBe(signatureB);
});

test("seed control applies deterministic shuffle without manual URL edit", async ({
page,
}) => {
await openOptions(page);
await page.fill("#seedInput", "ui-seed-123");
await page.locator("#seedApplyBtn").click();
await closeOptions(page);

await page.locator("#imageInput").setInputFiles(VALID_IMAGE);
await expect(page.locator("#status")).toContainText("Game active!");
const firstSignature = await page
.locator("#puzzle")
.getAttribute("data-board-signature");

await page.reload();
await openOptions(page);
await expect(page.locator("#seedInput")).toHaveValue("ui-seed-123");
await closeOptions(page);

await page.locator("#imageInput").setInputFiles(VALID_IMAGE);
await expect(page.locator("#status")).toContainText("Game active!");
const secondSignature = await page
.locator("#puzzle")
.getAttribute("data-board-signature");

expect(firstSignature).toBeTruthy();
expect(firstSignature).toBe(secondSignature);
});

test("seed clear button removes seed and resets input after reload", async ({
page,
}) => {
await openOptions(page);
await page.fill("#seedInput", "temp-seed");
await page.locator("#seedApplyBtn").click();
expect(page.url()).toContain("seed=temp-seed");

await page.locator("#seedClearBtn").click();
await expect(page.locator("#seedInput")).toHaveValue("");
expect(page.url()).not.toContain("seed=");

await closeOptions(page);
await page.reload();
await openOptions(page);
await expect(page.locator("#seedInput")).toHaveValue("");
await closeOptions(page);
});

test.describe("best score persistence", () => {
test("today best is preserved when switching grid sizes", async ({
page,
}) => {
await seedTodayBestScores(page, {
best3: 12,
best4: 34,
allTime3: 10,
allTime4: 20,
});

await expectTodayBestForGrid(page, 3, 12);
await expectTodayBestForGrid(page, 4, 34);
await expectTodayBestForGrid(page, 3, 12);
});

test("today best remains correct after switch and reload", async ({
page,
}) => {
await seedTodayBestScores(page, { best3: 15, best4: 27, gridSize: 3 });

await page.reload();
await openOptions(page);
await expect(page.locator('#view-options [data-size="3"]')).toHaveClass(/active/);
await closeOptions(page);
await expect(page.locator("#bestMovesToday")).toHaveText("Today: 15");

await expectTodayBestForGrid(page, 4, 27);

await page.reload();
await openOptions(page);
await expect(page.locator('#view-options [data-size="4"]')).toHaveClass(/active/);
await closeOptions(page);
await expect(page.locator("#bestMovesToday")).toHaveText("Today: 27");

await expectTodayBestForGrid(page, 3, 15);
});
});
});

test.describe("navigation", () => {
test.beforeEach(async ({ page }) => {
await page.goto("/index.html");
});

test("menu opens and closes side panel", async ({ page }) => {
await expect(page.locator("#side-panel")).not.toHaveClass(/open/);
await page.locator("#btn-menu").click();
await expect(page.locator("#side-panel")).toHaveClass(/open/);
await page.locator("#btn-panel-close").click();
await expect(page.locator("#side-panel")).not.toHaveClass(/open/);
});

test("Rules view is shown and back button returns to game", async ({
page,
}) => {
await page.locator("#btn-menu").click();
await page.locator("#nav-rules").click();
await expect(page.locator("#view-rules")).not.toHaveAttribute("hidden");
await expect(page.locator("#view-game")).toHaveAttribute("hidden", "");
await page.locator("#view-rules .btn-back").click();
await expect(page.locator("#view-game")).not.toHaveAttribute("hidden");
});

test("About view is shown and back button returns to game", async ({
page,
}) => {
await page.locator("#btn-menu").click();
await page.locator("#nav-about").click();
await expect(page.locator("#view-about")).not.toHaveAttribute("hidden");
await page.locator("#view-about .btn-back").click();
await expect(page.locator("#view-game")).not.toHaveAttribute("hidden");
});

test("Options view is shown and OK button returns to game", async ({
page,
}) => {
await openOptions(page);
await expect(page.locator("#view-options")).not.toHaveAttribute("hidden");
await closeOptions(page);
await expect(page.locator("#view-game")).not.toHaveAttribute("hidden");
});

test("header badge shows current grid size", async ({ page }) => {
		await expect(page.locator("#app-header-badge")).toHaveText("4\u00d74");
		await openOptions(page);
		await page.locator('#view-options [data-size="3"]').click();
		await closeOptions(page);
		await expect(page.locator("#app-header-badge")).toHaveText("3\u00d73");
	});
});

test.describe("responsive overflow", () => {
test("avoids horizontal overflow on portrait mobile/tablet", async ({
page,
}) => {
const portraitViewports = [
{ width: 320, height: 568 },
{ width: 390, height: 844 },
{ width: 768, height: 1024 },
];

for (const viewport of portraitViewports) {
await page.setViewportSize(viewport);
await page.goto("/index.html");

await expectNoHorizontalOverflow(page);

await page.locator("#imageInput").setInputFiles(VALID_IMAGE);
await expect(page.locator("#status")).toContainText("Game active!");
await expectNoHorizontalOverflow(page);

await openOptions(page);
await page.locator('#view-options [data-size="5"]').click();
await closeOptions(page);
await expect(page.locator("#puzzle .tile")).toHaveCount(25);
await expectNoHorizontalOverflow(page);
}
});
});
