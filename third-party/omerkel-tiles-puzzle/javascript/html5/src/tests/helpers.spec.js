const { test, expect } = require("@playwright/test");

test.describe("helper modules", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/index.html");
	});

	test("board.isAdjacent respects dynamic grid size", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const board = await import("./js/board.js");
			return {
				near3: board.isAdjacent(7, 8, 3),
				far3: board.isAdjacent(4, 8, 3),
				far5: board.isAdjacent(18, 24, 5),
				near5: board.isAdjacent(23, 24, 5),
			};
		});

		expect(result).toEqual({
			near3: true,
			far3: false,
			far5: false,
			near5: true,
		});
	});

	test("board.getValidMoves returns correct neighbors", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const board = await import("./js/board.js");
			return {
				moves3: board.getValidMoves(8, 3).sort((a, b) => a - b),
				moves5: board.getValidMoves(12, 5).sort((a, b) => a - b),
			};
		});

		expect(result.moves3).toEqual([5, 7]);
		expect(result.moves5).toEqual([7, 11, 13, 17]);
	});

	test("board.createSeededRandom yields deterministic sequence", async ({
		page,
	}) => {
		const result = await page.evaluate(async () => {
			const board = await import("./js/board.js");
			const rngA = board.createSeededRandom("abc123");
			const rngB = board.createSeededRandom("abc123");

			const seqA = [rngA(), rngA(), rngA()];
			const seqB = [rngB(), rngB(), rngB()];

			const pickedA = board.pickRandomItem(
				[10, 20, 30],
				board.createSeededRandom("pick-seed"),
			);
			const pickedB = board.pickRandomItem(
				[10, 20, 30],
				board.createSeededRandom("pick-seed"),
			);

			return { seqA, seqB, pickedA, pickedB };
		});

		expect(result.seqA).toEqual(result.seqB);
		expect(result.pickedA).toBe(result.pickedB);
	});

	test("input helper mappings work for keyboard and swipe", async ({
		page,
	}) => {
		const result = await page.evaluate(async () => {
			const input = await import("./js/input.js");
			return {
				downFromBottomRight: input.keyToTarget("ArrowDown", 15, 4),
				rightFromBottomRight: input.keyToTarget("ArrowRight", 15, 4),
				upBlockedAtBottomRight: input.keyToTarget("ArrowUp", 15, 4),
				shortSwipe: input.swipeToTarget(10, 0, 12, 4, 30),
				swipeRight: input.swipeToTarget(45, 0, 13, 4, 30),
				swipeDown: input.swipeToTarget(0, 50, 12, 4, 30),
			};
		});

		expect(result.downFromBottomRight).toBe(11);
		expect(result.rightFromBottomRight).toBe(14);
		expect(result.upBlockedAtBottomRight).toBe(-1);
		expect(result.shortSwipe).toBe(-1);
		expect(result.swipeRight).toBe(12);
		expect(result.swipeDown).toBe(8);
	});

	test("storage.loadGridSize clamps invalid values", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const storage = await import("./js/storage.js");
			const fake = {
				getItem(key) {
					if (key === "puzzle15_gridSize") return "99";
					return null;
				},
			};
			return storage.loadGridSize(fake, 4);
		});

		expect(result).toBe(4);
	});

	test("storage.pruneOldBestKeys keeps same-day keys across sizes", async ({
		page,
	}) => {
		const result = await page.evaluate(async () => {
			const storage = await import("./js/storage.js");
			const data = new Map([
				["puzzle15_best_3x3_2026-03-27", "12"],
				["puzzle15_best_4x4_2026-03-27", "30"],
				["puzzle15_best_5x5_2026-03-26", "99"],
			]);

			const fake = {
				get length() {
					return data.size;
				},
				key(index) {
					return Array.from(data.keys())[index] ?? null;
				},
				getItem(key) {
					return data.has(key) ? data.get(key) : null;
				},
				setItem(key, value) {
					data.set(key, `${value}`);
				},
				removeItem(key) {
					data.delete(key);
				},
			};

			storage.pruneOldBestKeys(3, fake, new Date("2026-03-27T10:00:00Z"));

			return {
				keep3: fake.getItem("puzzle15_best_3x3_2026-03-27"),
				keep4: fake.getItem("puzzle15_best_4x4_2026-03-27"),
				drop5: fake.getItem("puzzle15_best_5x5_2026-03-26"),
			};
		});

		expect(result.keep3).toBe("12");
		expect(result.keep4).toBe("30");
		expect(result.drop5).toBeNull();
	});

	test("storage.migrateLegacyScoreKeys migrates to current key format", async ({
		page,
	}) => {
		const result = await page.evaluate(async () => {
			const storage = await import("./js/storage.js");
			const data = new Map([
				["puzzle15_best_2026-03-27", "22"],
				["puzzle15_bestMoves", "44"],
			]);

			const fake = {
				get length() {
					return data.size;
				},
				key(index) {
					return Array.from(data.keys())[index] ?? null;
				},
				getItem(key) {
					return data.has(key) ? data.get(key) : null;
				},
				setItem(key, value) {
					data.set(key, `${value}`);
				},
				removeItem(key) {
					data.delete(key);
				},
			};

			storage.migrateLegacyScoreKeys(fake);

			return {
				oldDaily: fake.getItem("puzzle15_best_2026-03-27"),
				newDaily: fake.getItem("puzzle15_best_4x4_2026-03-27"),
				oldAllTime: fake.getItem("puzzle15_bestMoves"),
				newAllTime: fake.getItem("puzzle15_bestMoves_4x4"),
			};
		});

		expect(result.oldDaily).toBeNull();
		expect(result.newDaily).toBe("22");
		expect(result.oldAllTime).toBeNull();
		expect(result.newAllTime).toBe("44");
	});

	test("storage.resetAllSettings clears settings and score keys only", async ({
		page,
	}) => {
		const result = await page.evaluate(async () => {
			const storage = await import("./js/storage.js");
			const data = new Map([
				["puzzle15_gridSize", "3"],
				["puzzle15_showNumbers", "1"],
				["puzzle15_best_3x3_2026-03-27", "10"],
				["puzzle15_bestMoves_3x3", "8"],
				["keep_me", "ok"],
			]);

			const fake = {
				get length() {
					return data.size;
				},
				key(index) {
					return Array.from(data.keys())[index] ?? null;
				},
				getItem(key) {
					return data.has(key) ? data.get(key) : null;
				},
				setItem(key, value) {
					data.set(key, `${value}`);
				},
				removeItem(key) {
					data.delete(key);
				},
			};

			storage.resetAllSettings(fake);

			return {
				grid: fake.getItem("puzzle15_gridSize"),
				numbers: fake.getItem("puzzle15_showNumbers"),
				bestDay: fake.getItem("puzzle15_best_3x3_2026-03-27"),
				bestAll: fake.getItem("puzzle15_bestMoves_3x3"),
				keep: fake.getItem("keep_me"),
			};
		});

		expect(result.grid).toBeNull();
		expect(result.numbers).toBeNull();
		expect(result.bestDay).toBeNull();
		expect(result.bestAll).toBeNull();
		expect(result.keep).toBe("ok");
	});
});
