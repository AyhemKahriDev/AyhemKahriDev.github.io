function resetTileElement(el, tileWidth, tileHeight) {
	el.className = "tile";
	el.innerHTML = "";
	el.style.backgroundImage = "";
	el.style.backgroundSize = "";
	el.style.backgroundPosition = "";
	el.style.transform = "";
	el.style.transition = "";
	el.style.width = `${tileWidth}px`;
	el.style.height = `${tileHeight}px`;
	el.onclick = null;
}

function applyTileContent(
	el,
	{
		position,
		emptyIndex,
		tiles,
		gridSize,
		tileWidth,
		tileHeight,
		boardWidth,
		boardHeight,
		scaledImageDataUrl,
		showNumbers,
		onMove,
	},
) {
	if (position === emptyIndex) {
		el.classList.add("empty");
		return;
	}

	const tileObj = tiles[position];
	const sourceRow = Math.floor(tileObj.correctIndex / gridSize);
	const sourceCol = tileObj.correctIndex % gridSize;

	el.style.backgroundImage = `url('${scaledImageDataUrl}')`;
	el.style.backgroundSize = `${boardWidth}px ${boardHeight}px`;
	el.style.backgroundPosition = `${-sourceCol * tileWidth}px ${-sourceRow * tileHeight}px`;
	el.onclick = () => onMove(position);

	if (showNumbers) {
		const num = document.createElement("span");
		num.className = "tile-number";
		num.textContent = tileObj.correctIndex + 1;
		el.appendChild(num);
	}
}

export function applyBoardDimensions(
	puzzleContainer,
	{ gridSize, tileWidth, tileHeight, boardWidth, boardHeight },
) {
	const extra = 12 + (gridSize - 1) * 2;
	puzzleContainer.style.gridTemplateColumns = `repeat(${gridSize}, ${tileWidth}px)`;
	puzzleContainer.style.gridTemplateRows = `repeat(${gridSize}, ${tileHeight}px)`;
	puzzleContainer.style.width = `${boardWidth + extra}px`;
	puzzleContainer.style.height = `${boardHeight + extra}px`;
	puzzleContainer.style.setProperty("--board-width", `${boardWidth}px`);
	puzzleContainer.style.setProperty("--board-height", `${boardHeight}px`);
}

export function createTileElement(options) {
	const tile = document.createElement("div");
	resetTileElement(tile, options.tileWidth, options.tileHeight);
	applyTileContent(tile, options);
	return tile;
}

export function updateTileElement(el, options) {
	resetTileElement(el, options.tileWidth, options.tileHeight);
	applyTileContent(el, options);
}
