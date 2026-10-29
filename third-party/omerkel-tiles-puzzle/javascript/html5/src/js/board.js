export function createSolvedTiles(totalTiles) {
	return Array.from({ length: totalTiles }, (_, index) => ({
		correctIndex: index,
	}));
}

export function getTargetBoardSize(
	imageWidth,
	imageHeight,
	viewportWidth = window.innerWidth,
	viewportHeight = window.innerHeight,
) {
	const isLandscapeScreen = viewportWidth >= viewportHeight;
	const isMobileViewport = viewportWidth <= 768;
	const sidePanelWidth = 260;
	const layoutGap = 30;
	const sidePanelAllowance = sidePanelWidth + layoutGap + 20;
	const horizontalPaddingAllowance = isMobileViewport ? 56 : 140;
	const verticalPaddingAllowance = 160;
	const maxWidthFromViewport = Math.max(
		220,
		viewportWidth - horizontalPaddingAllowance,
	);

	const maxWidth = isLandscapeScreen
		? viewportWidth >= 1024
			? Math.max(220, maxWidthFromViewport - sidePanelAllowance)
			: maxWidthFromViewport
		: Math.max(220, maxWidthFromViewport - 8);
	const maxHeight = isLandscapeScreen
		? Math.max(240, Math.floor(viewportHeight * 0.82))
		: Math.max(240, viewportHeight - verticalPaddingAllowance - 180);

	const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight);

	return {
		targetWidth: Math.max(80, Math.floor(imageWidth * scale)),
		targetHeight: Math.max(80, Math.floor(imageHeight * scale)),
	};
}

export function isAdjacent(index, emptyIndex, gridSize) {
	const emptyRow = Math.floor(emptyIndex / gridSize);
	const emptyCol = emptyIndex % gridSize;
	const tileRow = Math.floor(index / gridSize);
	const tileCol = index % gridSize;

	return (
		(Math.abs(emptyRow - tileRow) === 1 && emptyCol === tileCol) ||
		(Math.abs(emptyCol - tileCol) === 1 && emptyRow === tileRow)
	);
}

export function getValidMoves(emptyIndex, gridSize) {
	const moves = [];
	const row = Math.floor(emptyIndex / gridSize);
	const col = emptyIndex % gridSize;

	if (row > 0) moves.push(emptyIndex - gridSize);
	if (row < gridSize - 1) moves.push(emptyIndex + gridSize);
	if (col > 0) moves.push(emptyIndex - 1);
	if (col < gridSize - 1) moves.push(emptyIndex + 1);

	return moves;
}

export function getManhattanDistance(tiles, gridSize) {
	let total = 0;
	for (let i = 0; i < tiles.length; i++) {
		const tile = tiles[i];
		if (!tile) continue;
		const fromRow = Math.floor(i / gridSize);
		const fromCol = i % gridSize;
		const toRow = Math.floor(tile.correctIndex / gridSize);
		const toCol = tile.correctIndex % gridSize;
		total += Math.abs(fromRow - toRow) + Math.abs(fromCol - toCol);
	}
	return total;
}

export function getPuzzleName(gridSize, totalTiles) {
	const names = { 3: "8-Puzzle", 4: "15-Puzzle", 5: "24-Puzzle" };
	return names[gridSize] ?? `${totalTiles - 1}-Puzzle`;
}

export function createSeededRandom(seedInput) {
	const seed = String(seedInput ?? "").trim();
	if (!seed) return Math.random;

	let hash = 2166136261;
	for (let i = 0; i < seed.length; i++) {
		hash ^= seed.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}

	let state = hash >>> 0;
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return state / 4294967296;
	};
}

export function pickRandomItem(items, random = Math.random) {
	if (!items || items.length === 0) return undefined;
	const index = Math.floor(random() * items.length);
	return items[index];
}
