const GRID_SIZE_KEY = "puzzle15_gridSize";
const SHOW_NUMBERS_KEY = "puzzle15_showNumbers";
const BEST_DAILY_PREFIX = "puzzle15_best_";
const BEST_ALL_TIME_PREFIX = "puzzle15_bestMoves_";
const LEGACY_ALL_TIME_KEY = "puzzle15_bestMoves";
const ALLOWED_GRID_SIZES = new Set([3, 4, 5]);

function parseOrDefault(value, fallback = 0) {
	const parsed = parseInt(value || `${fallback}`, 10);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeGridSize(value, fallback = 4) {
	const parsed = parseOrDefault(value, fallback);
	return ALLOWED_GRID_SIZES.has(parsed) ? parsed : fallback;
}

function formatDateKey(now = new Date()) {
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function getTodayKey(gridSize, now = new Date()) {
	const safeSize = normalizeGridSize(gridSize, 4);
	return `${BEST_DAILY_PREFIX}${safeSize}x${safeSize}_${formatDateKey(now)}`;
}

export function getAllTimeKey(gridSize) {
	const safeSize = normalizeGridSize(gridSize, 4);
	return `${BEST_ALL_TIME_PREFIX}${safeSize}x${safeSize}`;
}

export function loadGridSize(storage = localStorage, defaultSize = 4) {
	return normalizeGridSize(storage.getItem(GRID_SIZE_KEY), defaultSize);
}

export function saveGridSize(gridSize, storage = localStorage) {
	storage.setItem(GRID_SIZE_KEY, normalizeGridSize(gridSize, 4));
}

export function loadShowNumbers(storage = localStorage) {
	return storage.getItem(SHOW_NUMBERS_KEY) === "1";
}

export function saveShowNumbers(showNumbers, storage = localStorage) {
	storage.setItem(SHOW_NUMBERS_KEY, showNumbers ? "1" : "0");
}

export function loadBestScores(gridSize, storage = localStorage) {
	return {
		bestMovesToday: parseOrDefault(storage.getItem(getTodayKey(gridSize)), 0),
		bestMovesAllTime: parseOrDefault(
			storage.getItem(getAllTimeKey(gridSize)),
			0,
		),
	};
}

export function migrateLegacyScoreKeys(storage = localStorage) {
	const legacyAllTime = storage.getItem(LEGACY_ALL_TIME_KEY);
	if (legacyAllTime !== null && storage.getItem(getAllTimeKey(4)) === null) {
		storage.setItem(getAllTimeKey(4), legacyAllTime);
	}
	storage.removeItem(LEGACY_ALL_TIME_KEY);

	const legacyDailyPattern = /^puzzle15_best_(\d{4}-\d{2}-\d{2})$/;
	const toRemove = [];

	for (let i = 0; i < storage.length; i++) {
		const key = storage.key(i);
		if (!key) continue;

		const match = key.match(legacyDailyPattern);
		if (!match) continue;

		const legacyValue = storage.getItem(key);
		const migratedKey = `${BEST_DAILY_PREFIX}4x4_${match[1]}`;
		if (legacyValue !== null && storage.getItem(migratedKey) === null) {
			storage.setItem(migratedKey, legacyValue);
		}
		toRemove.push(key);
	}

	toRemove.forEach((key) => {
		storage.removeItem(key);
	});
}

export function saveBestToday(gridSize, value, storage = localStorage) {
	storage.setItem(getTodayKey(gridSize), value);
}

export function saveBestAllTime(gridSize, value, storage = localStorage) {
	storage.setItem(getAllTimeKey(gridSize), value);
}

export function resetBestScores(gridSize, storage = localStorage) {
	storage.removeItem(getTodayKey(gridSize));
	storage.removeItem(getAllTimeKey(gridSize));
}

export function pruneOldBestKeys(
	_gridSize,
	storage = localStorage,
	now = new Date(),
) {
	const todayDate = formatDateKey(now);
	const toRemove = [];

	for (let i = 0; i < storage.length; i++) {
		const key = storage.key(i);
		if (!key?.startsWith(BEST_DAILY_PREFIX)) continue;

		const datePart = key.substring(key.lastIndexOf("_") + 1);
		if (datePart !== todayDate) {
			toRemove.push(key);
		}
	}

	toRemove.forEach((key) => {
		storage.removeItem(key);
	});
}

export function resetAllSettings(storage = localStorage) {
	storage.removeItem(GRID_SIZE_KEY);
	storage.removeItem(SHOW_NUMBERS_KEY);
	storage.removeItem(LEGACY_ALL_TIME_KEY);

	const toRemove = [];
	for (let i = 0; i < storage.length; i++) {
		const key = storage.key(i);
		if (!key) continue;
		if (
			key.startsWith(BEST_DAILY_PREFIX) ||
			key.startsWith(BEST_ALL_TIME_PREFIX)
		) {
			toRemove.push(key);
		}
	}
	toRemove.forEach((key) => {
		storage.removeItem(key);
	});
}
