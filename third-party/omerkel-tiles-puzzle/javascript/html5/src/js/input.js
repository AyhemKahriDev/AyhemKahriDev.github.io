export function isInteractiveInputTarget(target) {
	const tagName = target?.tagName;
	return (
		tagName === "INPUT" || tagName === "TEXTAREA" || target?.isContentEditable
	);
}

export function keyToTarget(key, emptyIndex, gridSize) {
	const row = Math.floor(emptyIndex / gridSize);
	const col = emptyIndex % gridSize;
	const gs = gridSize;

	const keyMap = {
		ArrowUp: row < gs - 1 ? emptyIndex + gs : -1,
		ArrowDown: row > 0 ? emptyIndex - gs : -1,
		ArrowLeft: col < gs - 1 ? emptyIndex + 1 : -1,
		ArrowRight: col > 0 ? emptyIndex - 1 : -1,
		w: row < gs - 1 ? emptyIndex + gs : -1,
		s: row > 0 ? emptyIndex - gs : -1,
		a: col < gs - 1 ? emptyIndex + 1 : -1,
		d: col > 0 ? emptyIndex - 1 : -1,
	};

	return keyMap[key];
}

export function swipeToTarget(dx, dy, emptyIndex, gridSize, threshold = 30) {
	const absDx = Math.abs(dx);
	const absDy = Math.abs(dy);
	if (Math.max(absDx, absDy) < threshold) {
		return -1;
	}

	const row = Math.floor(emptyIndex / gridSize);
	const col = emptyIndex % gridSize;
	let target = -1;

	if (absDx > absDy) {
		if (dx > 0 && col > 0) target = emptyIndex - 1;
		if (dx < 0 && col < gridSize - 1) target = emptyIndex + 1;
	} else {
		if (dy > 0 && row > 0) target = emptyIndex - gridSize;
		if (dy < 0 && row < gridSize - 1) target = emptyIndex + gridSize;
	}

	return target;
}
