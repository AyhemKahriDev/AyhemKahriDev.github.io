/**
 * Tiles Puzzle Game Implementation
 *
 * Features:
 * - Select any image to create a custom puzzle (JPEG, PNG, WebP; GIF supported but not animated)
 * - Image scaled to fit the screen preserving aspect ratio (portrait/landscape aware)
 * - Tile moves via click, keyboard arrow keys (or WASD), or touch swipe; press R to reshuffle
 * - Three difficulty levels: 3×3 (8-puzzle), 4×4 (15-puzzle), 5×5 (24-puzzle)
 * - FLIP animation on tile moves
 * - Optional tile number overlay
 * - Solved state: tiles fade out, full image fades in
 * - Move counter with today's best and all-time best (persisted via localStorage)
 * - Responsive layout; re-scales board on window resize
 *
 * Author: Oliver Merkel
 * Date: 2026-03
 * License: MIT
 */

import {
	getManhattanDistance as computeManhattanDistance,
	getTargetBoardSize as computeTargetBoardSize,
	createSeededRandom,
	createSolvedTiles,
	getValidMoves as getBoardValidMoves,
	getPuzzleName,
	isAdjacent,
	pickRandomItem,
} from "./board.js";
import {
	isInteractiveInputTarget,
	keyToTarget,
	swipeToTarget,
} from "./input.js";
import {
	loadBestScores,
	loadGridSize,
	loadShowNumbers,
	migrateLegacyScoreKeys,
	pruneOldBestKeys as pruneOldBestKeysFromStorage,
	resetAllSettings,
	resetBestScores,
	saveBestAllTime,
	saveBestToday,
	saveGridSize,
	saveShowNumbers,
} from "./storage.js";
import {
	applyBoardDimensions as applyViewBoardDimensions,
	createTileElement,
	updateTileElement as updateViewTileElement,
} from "./view.js";

class PuzzleGame {
	constructor() {
		this.MAX_IMAGE_SIZE_BYTES = 12 * 1024 * 1024;
		this.ALLOWED_IMAGE_MIME_TYPES = new Set([
			"image/jpeg",
			"image/png",
			"image/webp",
			"image/gif",
		]);
		migrateLegacyScoreKeys(localStorage);

		this.gridSize = loadGridSize(localStorage, 4);
		this.totalTiles = this.gridSize * this.gridSize;
		this.shuffleSeed =
			new URLSearchParams(window.location.search).get("seed") || "";
		this.random = createSeededRandom(this.shuffleSeed);
		this.puzzleContainer = document.getElementById("puzzle");
		this.imageInput = document.getElementById("imageInput");
		this.resetBtn = document.getElementById("resetBtn");
		this.statusEl = document.getElementById("status");
		this.movesEl = document.getElementById("moves");
		this.seedInput = document.getElementById("seedInput");
		this.seedApplyBtn = document.getElementById("seedApplyBtn");
		this.seedClearBtn = document.getElementById("seedClearBtn");
		this.celebrationCanvas = document.getElementById("celebrationCanvas");
		this.celebrationCtx = this.celebrationCanvas
			? this.celebrationCanvas.getContext("2d")
			: null;

		this.tiles = [];
		this.emptyIndex = this.totalTiles - 1;
		this.moves = 0;
		this.tileWidth = 80;
		this.tileHeight = 80;
		this.boardWidth = 320;
		this.boardHeight = 320;
		this.originalImageDataUrl = "";
		this.scaledImageDataUrl = "";
		this.imageFormat = "image/jpeg";
		this.originalImageEl = null;
		this.isGameActive = false;
		this.isSolved = false;
		this.resizeTimer = null;
		this.gameMessage = "";
		this.gameMessageColor = "#555";
		this.showNumbers = loadShowNumbers(localStorage);
		this.touchStartX = 0;
		this.touchStartY = 0;
		this.celebrationParticles = [];
		this.celebrationFrameId = 0;
		this.celebrationEndAt = 0;
		this.celebrationBurstAt = 0;
		this.viewportWidth = 0;
		this.viewportHeight = 0;
		this.renderCelebrationFrame = this.renderCelebrationFrame.bind(this);
		const bestScores = loadBestScores(this.gridSize, localStorage);
		this.bestMovesToday = bestScores.bestMovesToday;
		this.bestMovesAllTime = bestScores.bestMovesAllTime;
		this.bestMovesTodayEl = document.getElementById("bestMovesToday");
		this.bestMovesAllTimeEl = document.getElementById("bestMovesAllTime");
		this.resetBestBtn = document.getElementById("resetBestBtn");
		this.resetSettingsBtn = document.getElementById("resetSettingsBtn");
		this.numberToggleBtn = document.getElementById("numberToggleBtn");
		this.difficultyBtns = document.querySelectorAll(".diff-btn");
		this.titleEl = document.getElementById("gameTitle");

		pruneOldBestKeysFromStorage(this.gridSize, localStorage);

		this.imageInput.addEventListener("change", (e) =>
			this.handleImageUpload(e),
		);
		this.resetBtn.addEventListener("click", () => this.shuffleTiles());
		this.resetBestBtn.addEventListener("click", () => this.resetBestScore());
		this.resetSettingsBtn.addEventListener("click", () => this.resetSettings());
		this.seedApplyBtn.addEventListener("click", () =>
			this.applySeedFromInput(),
		);
		this.seedClearBtn.addEventListener("click", () => this.clearSeed());
		this.seedInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				this.applySeedFromInput();
			}
		});
		this.numberToggleBtn.addEventListener("click", () => this.toggleNumbers());
		this.difficultyBtns.forEach((btn) => {
			btn.addEventListener("click", () =>
				this.setDifficulty(parseInt(btn.dataset.size, 10)),
			);
		});
		this.puzzleContainer.addEventListener(
			"touchstart",
			(e) => this.handleTouchStart(e),
			{ passive: true },
		);
		this.puzzleContainer.addEventListener(
			"touchend",
			(e) => this.handleTouchEnd(e),
			{ passive: false },
		);
		window.addEventListener("resize", () => this.handleResize());
		window.addEventListener("keydown", (e) => this.handleKeyDown(e));
		this.seedInput.value = this.shuffleSeed;
		this.resizeCelebrationCanvas();
		this.updateNumberToggleState();
		this.updateDifficultyButtons(this.gridSize);
		this._updateTitle();
		this.updateBestDisplay();
	}

	handleImageUpload(event) {
		const file = event.target.files[0];
		if (!file) return;

		if (!this.ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
			this.setStatus(
				"Unsupported image type. Please choose JPEG, PNG, WebP, or GIF.",
				"#e74c3c",
			);
			this.imageInput.value = "";
			return;
		}

		if (file.size > this.MAX_IMAGE_SIZE_BYTES) {
			this.setStatus(
				"Image is too large. Please choose a file up to 12 MB.",
				"#e74c3c",
			);
			this.imageInput.value = "";
			return;
		}

		const reader = new FileReader();
		reader.onload = (e) => {
			this.originalImageDataUrl = e.target.result;
			// Preserve PNG/WebP so transparent areas aren't destroyed
			const mime = file.type;
			this.imageFormat =
				mime === "image/png" || mime === "image/webp" ? mime : "image/jpeg";
			const img = new Image();
			img.onload = () => {
				this.originalImageEl = img;
				this.initializePuzzle(img);
			};
			img.onerror = () => {
				this.setStatus(
					"Could not read this image. Please try another file.",
					"#e74c3c",
				);
			};
			img.src = e.target.result;
		};
		reader.onerror = () => {
			this.setStatus(
				"Could not read this file. Please choose another image.",
				"#e74c3c",
			);
		};
		reader.readAsDataURL(file);
	}

	initializePuzzle(img) {
		const { targetWidth, targetHeight } = this.getTargetBoardSize(
			img.width,
			img.height,
		);
		this.boardWidth = targetWidth;
		this.boardHeight = targetHeight;
		this.tileWidth = this.boardWidth / this.gridSize;
		this.tileHeight = this.boardHeight / this.gridSize;

		// Create scaled image first (upscale or downscale), preserving aspect ratio
		const canvas = document.createElement("canvas");
		canvas.width = this.boardWidth;
		canvas.height = this.boardHeight;
		const ctx = canvas.getContext("2d");
		ctx.drawImage(img, 0, 0, this.boardWidth, this.boardHeight);
		this.scaledImageDataUrl = canvas.toDataURL(this.imageFormat);

		this.tiles = createSolvedTiles(this.totalTiles);

		// Render puzzle
		this.emptyIndex = this.totalTiles - 1;
		this.moves = 0;
		this.isSolved = false;
		this.shuffleTiles(true); // silent — initializePuzzle sets its own status below
		this.isGameActive = true;
		this.resetBtn.disabled = false;
		this.setStatus("Game active! Rearrange the tiles.");
		this.updateMovesDisplay();
	}

	getTargetBoardSize(imageWidth, imageHeight) {
		return computeTargetBoardSize(
			imageWidth,
			imageHeight,
			window.innerWidth,
			window.innerHeight,
		);
	}

	applyBoardDimensions() {
		applyViewBoardDimensions(this.puzzleContainer, {
			gridSize: this.gridSize,
			tileWidth: this.tileWidth,
			tileHeight: this.tileHeight,
			boardWidth: this.boardWidth,
			boardHeight: this.boardHeight,
		});
	}

	handleResize() {
		this.resizeCelebrationCanvas();
		if (!this.isGameActive || !this.originalImageDataUrl) return;
		clearTimeout(this.resizeTimer);
		this.resizeTimer = setTimeout(() => this._doResize(), 150);
	}

	resizeCelebrationCanvas() {
		if (!this.celebrationCanvas || !this.celebrationCtx) return;
		const viewport = window.visualViewport;
		const width = viewport?.width ?? window.innerWidth;
		const height = viewport?.height ?? window.innerHeight;
		const pixelRatio = window.devicePixelRatio || 1;

		this.viewportWidth = Math.max(1, Math.floor(width));
		this.viewportHeight = Math.max(1, Math.floor(height));

		this.celebrationCanvas.style.width = `${this.viewportWidth}px`;
		this.celebrationCanvas.style.height = `${this.viewportHeight}px`;
		this.celebrationCanvas.width = Math.floor(this.viewportWidth * pixelRatio);
		this.celebrationCanvas.height = Math.floor(
			this.viewportHeight * pixelRatio,
		);
		this.celebrationCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
	}

	_doResize() {
		const applyResize = (image) => {
			const currentBoardState = [...this.tiles];
			const currentEmptyIndex = this.emptyIndex;
			const currentMoves = this.moves;
			const currentSolved = this.isSolved;

			const { targetWidth, targetHeight } = this.getTargetBoardSize(
				image.width,
				image.height,
			);
			this.boardWidth = targetWidth;
			this.boardHeight = targetHeight;
			this.tileWidth = this.boardWidth / this.gridSize;
			this.tileHeight = this.boardHeight / this.gridSize;

			const canvas = document.createElement("canvas");
			canvas.width = this.boardWidth;
			canvas.height = this.boardHeight;
			const ctx = canvas.getContext("2d");
			ctx.drawImage(image, 0, 0, this.boardWidth, this.boardHeight);
			this.scaledImageDataUrl = canvas.toDataURL(this.imageFormat);

			this.tiles = currentBoardState;
			this.emptyIndex = currentEmptyIndex;
			this.moves = currentMoves;
			this.isSolved = currentSolved;

			this.renderPuzzle();
			this.setStatus(this.gameMessage, this.gameMessageColor);
			this.updateMovesDisplay();
		};

		if (this.originalImageEl?.complete) {
			applyResize(this.originalImageEl);
			return;
		}

		const image = new Image();
		image.onload = () => {
			this.originalImageEl = image;
			applyResize(image);
		};
		image.src = this.originalImageDataUrl;
	}

	renderPuzzle() {
		this.applyBoardDimensions();
		this.puzzleContainer.style.setProperty(
			"--full-image",
			`url("${this.scaledImageDataUrl}")`,
		);
		this.puzzleContainer.classList.toggle("solved", this.isSolved);
		this.puzzleContainer.innerHTML = "";

		for (let i = 0; i < this.totalTiles; i++) {
			const tile = createTileElement({
				position: i,
				emptyIndex: this.emptyIndex,
				tiles: this.tiles,
				gridSize: this.gridSize,
				tileWidth: this.tileWidth,
				tileHeight: this.tileHeight,
				boardWidth: this.boardWidth,
				boardHeight: this.boardHeight,
				scaledImageDataUrl: this.scaledImageDataUrl,
				showNumbers: this.showNumbers,
				onMove: (index) => this.moveTile(index),
			});

			this.puzzleContainer.appendChild(tile);
		}
		this.refreshMovableHints();
		this.updateBoardSignature();
	}

	refreshMovableHints() {
		const validMoves = new Set(this.getLineMovableTiles());
		for (let i = 0; i < this.totalTiles; i++) {
			const el = this.puzzleContainer.children[i];
			if (el) el.classList.toggle("movable", validMoves.has(i));
		}
	}

	getLineMovableTiles() {
		const moves = [];
		const emptyRow = Math.floor(this.emptyIndex / this.gridSize);
		const emptyCol = this.emptyIndex % this.gridSize;

		for (let i = 0; i < this.totalTiles; i++) {
			if (i === this.emptyIndex) continue;
			const row = Math.floor(i / this.gridSize);
			const col = i % this.gridSize;
			if (row === emptyRow || col === emptyCol) {
				moves.push(i);
			}
		}

		return moves;
	}

	getSlidePath(index) {
		if (index === this.emptyIndex) return [];

		const emptyRow = Math.floor(this.emptyIndex / this.gridSize);
		const emptyCol = this.emptyIndex % this.gridSize;
		const row = Math.floor(index / this.gridSize);
		const col = index % this.gridSize;

		let step = 0;
		if (row === emptyRow) {
			step = index < this.emptyIndex ? -1 : 1;
		} else if (col === emptyCol) {
			step = index < this.emptyIndex ? -this.gridSize : this.gridSize;
		} else {
			return null;
		}

		const path = [];
		for (
			let pos = this.emptyIndex + step;
			step > 0 ? pos <= index : pos >= index;
			pos += step
		) {
			path.push(pos);
		}

		return path;
	}

	moveTile(index) {
		if (!this.isGameActive || this.isSolved) return;
		const path = this.getSlidePath(index);
		if (!path || path.length === 0) return;

		const oldEmptyIndex = this.emptyIndex;
		const isSingleStep =
			path.length === 1 && isAdjacent(index, oldEmptyIndex, this.gridSize);

		let movingEl;
		let startRect;
		if (isSingleStep) {
			// FLIP for one-step moves keeps the original animation polish.
			movingEl = this.puzzleContainer.children[index];
			startRect = movingEl.getBoundingClientRect();
		}

		for (const source of path) {
			[this.tiles[source], this.tiles[this.emptyIndex]] = [
				this.tiles[this.emptyIndex],
				this.tiles[source],
			];
			this.emptyIndex = source;
		}
		this.moves++;

		const affectedPositions = [oldEmptyIndex, ...path];
		for (const position of affectedPositions) {
			this.updateTileEl(position);
		}
		this.refreshMovableHints();
		this.updateBoardSignature();

		if (isSingleStep) {
			const landedEl = this.puzzleContainer.children[oldEmptyIndex];
			const endRect = landedEl.getBoundingClientRect();
			const dx = startRect.left - endRect.left;
			const dy = startRect.top - endRect.top;

			landedEl.style.transition = "none";
			landedEl.style.transform = `translate(${dx}px, ${dy}px)`;
			landedEl.offsetHeight; // force reflow
			landedEl.style.transition = "transform 150ms ease, opacity 500ms ease";
			landedEl.style.transform = "";
		}

		this.updateMovesDisplay();
		this.checkWinCondition();
	}

	updateTileEl(position) {
		const el = this.puzzleContainer.children[position];
		if (!el) return;

		updateViewTileElement(el, {
			position,
			emptyIndex: this.emptyIndex,
			tiles: this.tiles,
			gridSize: this.gridSize,
			tileWidth: this.tileWidth,
			tileHeight: this.tileHeight,
			boardWidth: this.boardWidth,
			boardHeight: this.boardHeight,
			scaledImageDataUrl: this.scaledImageDataUrl,
			showNumbers: this.showNumbers,
			onMove: (index) => this.moveTile(index),
		});
	}

	handleKeyDown(e) {
		if (isInteractiveInputTarget(e.target)) return;
		if (e.key === "?") {
			e.preventDefault();
			this.setStatus(
				"⌨️ Shortcuts: Arrow keys/WASD move, Shift+Arrow/Shift+WASD shifts a whole line, R reshuffles, ? shows this help.",
			);
			return;
		}
		if (!this.isGameActive) return;
		if (e.key === "r" || e.key === "R") {
			e.preventDefault();
			this.shuffleTiles();
			return;
		}
		if (this.isSolved) return;
		if (e.shiftKey) {
			const lineTarget = this.getLineShiftTargetForKey(e.key);
			if (lineTarget >= 0) {
				e.preventDefault();
				this.moveTile(lineTarget);
				return;
			}
		}
		const target = keyToTarget(e.key, this.emptyIndex, this.gridSize);
		if (target !== undefined && target >= 0) {
			e.preventDefault();
			this.moveTile(target);
		}
	}

	getLineShiftTargetForKey(key) {
		const normalizedKey =
			{
				w: "ArrowUp",
				a: "ArrowLeft",
				s: "ArrowDown",
				d: "ArrowRight",
			}[String(key).toLowerCase()] ?? key;

		const row = Math.floor(this.emptyIndex / this.gridSize);
		const col = this.emptyIndex % this.gridSize;

		switch (normalizedKey) {
			case "ArrowUp":
				return row < this.gridSize - 1
					? (this.gridSize - 1) * this.gridSize + col
					: -1;
			case "ArrowDown":
				return row > 0 ? col : -1;
			case "ArrowLeft":
				return col < this.gridSize - 1
					? row * this.gridSize + (this.gridSize - 1)
					: -1;
			case "ArrowRight":
				return col > 0 ? row * this.gridSize : -1;
			default:
				return -1;
		}
	}

	shuffleTiles(silent = false) {
		// Perform random valid moves to shuffle, retrying if board is too close to solved
		this.stopCelebration();
		this.isSolved = false;
		const shuffleCount = { 3: 100, 4: 200, 5: 400 }[this.gridSize] ?? 200;
		const minDistance = { 3: 8, 4: 18, 5: 32 }[this.gridSize] ?? 18;
		const maxAttempts = 8;
		let attempts = 0;

		do {
			this.tiles = createSolvedTiles(this.totalTiles);
			this.emptyIndex = this.totalTiles - 1;

			for (let i = 0; i < shuffleCount; i++) {
				const validMoves = this.getValidMoves();
				const randomMove = pickRandomItem(validMoves, this.random);
				[this.tiles[randomMove], this.tiles[this.emptyIndex]] = [
					this.tiles[this.emptyIndex],
					this.tiles[randomMove],
				];
				this.emptyIndex = randomMove;
			}
			attempts++;
		} while (
			this.getManhattanDistance() < minDistance &&
			attempts < maxAttempts
		);

		this.moves = 0;
		this.renderPuzzle();
		this.updateMovesDisplay();
		if (!silent) {
			const seedHint = this.shuffleSeed ? ` (seed: ${this.shuffleSeed})` : "";
			this.setStatus(`Puzzle shuffled! Let's go!${seedHint}`);
		}
	}

	getValidMoves() {
		return getBoardValidMoves(this.emptyIndex, this.gridSize);
	}

	getManhattanDistance() {
		return computeManhattanDistance(this.tiles, this.gridSize);
	}

	checkWinCondition() {
		const isWon = this.tiles.every(
			(tile, index) => tile.correctIndex === index,
		);
		if (isWon) {
			this.isSolved = true;
			this.puzzleContainer.classList.add("solved");

			// Refresh today's best in case the date rolled over since the game was loaded
			const latestScores = loadBestScores(this.gridSize, localStorage);
			this.bestMovesToday = latestScores.bestMovesToday;

			const improvedToday =
				this.bestMovesToday === 0 || this.moves < this.bestMovesToday;
			const improvedAllTime =
				this.bestMovesAllTime === 0 || this.moves < this.bestMovesAllTime;

			if (improvedToday) {
				this.bestMovesToday = this.moves;
				saveBestToday(this.gridSize, this.bestMovesToday, localStorage);
			}
			if (improvedAllTime) {
				this.bestMovesAllTime = this.moves;
				saveBestAllTime(this.gridSize, this.bestMovesAllTime, localStorage);
			}
			this.updateBestDisplay();

			const bestMsg = improvedAllTime
				? " 🥇 New all-time best!"
				: improvedToday
					? " 🌟 New best today!"
					: "";
			this.setStatus(
				`✅ Congratulations! Puzzle solved in ${this.moves} moves!${bestMsg}`,
				"#27ae60",
			);
			this.startCelebration();
		}
	}

	updateMovesDisplay() {
		this.movesEl.textContent = `Moves: ${this.moves}`;
	}

	updateBestDisplay() {
		if (this.bestMovesTodayEl) {
			this.bestMovesTodayEl.textContent =
				this.bestMovesToday > 0 ? `Today: ${this.bestMovesToday}` : "Today: —";
		}
		if (this.bestMovesAllTimeEl) {
			this.bestMovesAllTimeEl.textContent =
				this.bestMovesAllTime > 0
					? `All time: ${this.bestMovesAllTime}`
					: "All time: —";
		}
	}

	resetBestScore() {
		if (!confirm("Reset all best scores?")) return;
		this.bestMovesToday = 0;
		this.bestMovesAllTime = 0;
		resetBestScores(this.gridSize, localStorage);
		this.updateBestDisplay();
	}

	_updateTitle() {
		const name = getPuzzleName(this.gridSize, this.totalTiles);
		this.titleEl.textContent = `${name} Game`;
	}

	updateDifficultyButtons(size) {
		this.difficultyBtns.forEach((btn) => {
			const isActive = parseInt(btn.dataset.size, 10) === size;
			btn.classList.toggle("active", isActive);
			btn.setAttribute("aria-pressed", isActive ? "true" : "false");
		});
	}

	updateNumberToggleState() {
		this.numberToggleBtn.classList.toggle("active", this.showNumbers);
		this.numberToggleBtn.setAttribute(
			"aria-pressed",
			this.showNumbers ? "true" : "false",
		);
	}

	setDifficulty(size) {
		if (size === this.gridSize) return;
		this.gridSize = size;
		this.totalTiles = size * size;
		saveGridSize(size, localStorage);
		this.updateDifficultyButtons(size);
		this._updateTitle();
		pruneOldBestKeysFromStorage(this.gridSize, localStorage);
		const bestScores = loadBestScores(this.gridSize, localStorage);
		this.bestMovesToday = bestScores.bestMovesToday;
		this.bestMovesAllTime = bestScores.bestMovesAllTime;
		this.updateBestDisplay();
		if (this.isGameActive && this.originalImageDataUrl) {
			const img = new Image();
			img.onload = () => this.initializePuzzle(img);
			img.src = this.originalImageDataUrl;
		}
	}

	setStatus(text, color = "") {
		this.gameMessage = text;
		this.gameMessageColor = color;
		this.statusEl.textContent = text;
		// Map old light-theme default colour to theme-neutral (CSS handles it via var(--text))
		this.statusEl.style.color = color && color !== "#555" ? color : "";
	}

	updateBoardSignature() {
		const signature = this.tiles.map((tile) => tile.correctIndex).join(",");
		this.puzzleContainer.dataset.boardSignature = signature;
	}

	applySeedFromInput() {
		this.shuffleSeed = this.seedInput.value.trim();
		this.random = createSeededRandom(this.shuffleSeed);

		const url = new URL(window.location.href);
		if (this.shuffleSeed) {
			url.searchParams.set("seed", this.shuffleSeed);
		} else {
			url.searchParams.delete("seed");
		}
		window.history.replaceState({}, "", `${url.pathname}${url.search}`);

		if (this.isGameActive) {
			this.shuffleTiles();
			return;
		}

		const seedMsg = this.shuffleSeed
			? `Seed applied: ${this.shuffleSeed}. Load an image to start.`
			: "Seed cleared. Random shuffle restored.";
		this.setStatus(seedMsg);
	}

	clearSeed() {
		this.seedInput.value = "";
		this.applySeedFromInput();
	}

	spawnCelebrationBurst() {
		const width = this.viewportWidth || window.innerWidth;
		const height = this.viewportHeight || window.innerHeight;
		const centerX = Math.random() * width;
		const centerY = 80 + Math.random() * (height * 0.35);
		const palette = [
			"#ff4d4f",
			"#ffd666",
			"#73d13d",
			"#40a9ff",
			"#9254de",
			"#ff85c0",
		];

		for (let i = 0; i < 90; i++) {
			const angle = Math.random() * Math.PI * 2;
			const speed = 80 + Math.random() * 280;
			const life = 1.6 + Math.random() * 1.6;
			this.celebrationParticles.push({
				type: "spark",
				x: centerX,
				y: centerY,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed - 40,
				gravity: 220 + Math.random() * 140,
				drag: 0.988,
				life,
				maxLife: life,
				size: 1.5 + Math.random() * 2.8,
				color: palette[Math.floor(Math.random() * palette.length)],
				angle: Math.random() * Math.PI * 2,
				spin: (Math.random() - 0.5) * 8,
			});
		}
	}

	spawnConfetti(count = 14) {
		const width = this.viewportWidth || window.innerWidth;
		const palette = [
			"#ff7875",
			"#ffd666",
			"#95de64",
			"#69c0ff",
			"#b37feb",
			"#ffadd2",
		];

		for (let i = 0; i < count; i++) {
			const life = 2.5 + Math.random() * 2.2;
			this.celebrationParticles.push({
				type: "confetti",
				x: Math.random() * width,
				y: -20 - Math.random() * 90,
				vx: (Math.random() - 0.5) * 150,
				vy: 80 + Math.random() * 160,
				gravity: 180 + Math.random() * 120,
				drag: 0.995,
				life,
				maxLife: life,
				size: 5 + Math.random() * 6,
				color: palette[Math.floor(Math.random() * palette.length)],
				angle: Math.random() * Math.PI * 2,
				spin: (Math.random() - 0.5) * 10,
			});
		}
	}

	renderCelebrationFrame(timestamp) {
		if (!this.celebrationCtx || !this.celebrationCanvas) return;
		this.resizeCelebrationCanvas();

		const now = timestamp / 1000;
		const stillActive = now < this.celebrationEndAt;

		if (stillActive && now >= this.celebrationBurstAt) {
			this.spawnCelebrationBurst();
			this.spawnConfetti(16);
			this.celebrationBurstAt = now + 0.35 + Math.random() * 0.2;
		}

		const dt = 1 / 60;
		const width = this.viewportWidth || window.innerWidth;
		const height = this.viewportHeight || window.innerHeight;
		this.celebrationCtx.clearRect(0, 0, width, height);

		const remaining = [];
		for (const particle of this.celebrationParticles) {
			particle.life -= dt;
			if (particle.life <= 0) continue;

			particle.vx *= particle.drag;
			particle.vy = particle.vy * particle.drag + particle.gravity * dt;
			particle.x += particle.vx * dt;
			particle.y += particle.vy * dt;
			particle.angle += particle.spin * dt;

			if (particle.y > height + 40) continue;

			const alpha = Math.max(0, particle.life / particle.maxLife);
			this.celebrationCtx.save();
			this.celebrationCtx.translate(particle.x, particle.y);
			this.celebrationCtx.rotate(particle.angle);
			this.celebrationCtx.globalAlpha = alpha;
			this.celebrationCtx.fillStyle = particle.color;
			if (particle.type === "spark") {
				this.celebrationCtx.beginPath();
				this.celebrationCtx.arc(0, 0, particle.size, 0, Math.PI * 2);
				this.celebrationCtx.fill();
			} else {
				this.celebrationCtx.fillRect(
					-particle.size * 0.45,
					-particle.size * 0.18,
					particle.size * 0.9,
					particle.size * 0.36,
				);
			}
			this.celebrationCtx.restore();

			remaining.push(particle);
		}

		this.celebrationParticles = remaining;

		if (stillActive || this.celebrationParticles.length > 0) {
			this.celebrationFrameId = requestAnimationFrame(
				this.renderCelebrationFrame,
			);
			return;
		}

		this.stopCelebration();
	}

	startCelebration() {
		if (!this.celebrationCanvas || !this.celebrationCtx) return;

		this.stopCelebration();
		this.resizeCelebrationCanvas();
		this.celebrationCanvas.classList.add("active");
		this.celebrationParticles = [];

		const now = performance.now() / 1000;
		this.celebrationEndAt = now + 5;
		this.celebrationBurstAt = now;

		this.celebrationFrameId = requestAnimationFrame(
			this.renderCelebrationFrame,
		);
	}

	stopCelebration() {
		if (this.celebrationFrameId) {
			cancelAnimationFrame(this.celebrationFrameId);
			this.celebrationFrameId = 0;
		}
		this.celebrationParticles = [];
		if (this.celebrationCanvas) {
			this.celebrationCanvas.classList.remove("active");
		}
		if (this.celebrationCtx) {
			this.celebrationCtx.clearRect(
				0,
				0,
				this.viewportWidth || window.innerWidth,
				this.viewportHeight || window.innerHeight,
			);
		}
	}

	toggleNumbers() {
		this.showNumbers = !this.showNumbers;
		saveShowNumbers(this.showNumbers, localStorage);
		this.updateNumberToggleState();
		if (this.isGameActive) this.renderPuzzle();
	}

	resetSettings() {
		if (!confirm("Reset all settings and scores?")) return;

		this.stopCelebration();

		resetAllSettings(localStorage);

		this.gridSize = 4;
		this.totalTiles = this.gridSize * this.gridSize;
		this.showNumbers = false;
		this.bestMovesToday = 0;
		this.bestMovesAllTime = 0;

		saveGridSize(this.gridSize, localStorage);
		saveShowNumbers(this.showNumbers, localStorage);

		this.updateDifficultyButtons(this.gridSize);
		this.updateNumberToggleState();
		this._updateTitle();
		this.updateBestDisplay();

		if (this.isGameActive && this.originalImageDataUrl) {
			const img = new Image();
			img.onload = () => this.initializePuzzle(img);
			img.src = this.originalImageDataUrl;
			return;
		}

		this.moves = 0;
		this.updateMovesDisplay();
		this.resetBtn.disabled = true;
		this.setStatus("Settings reset. Please select an image.");
	}

	handleTouchStart(e) {
		const t = e.touches[0];
		this.touchStartX = t.clientX;
		this.touchStartY = t.clientY;
	}

	handleTouchEnd(e) {
		if (!this.isGameActive || this.isSolved) return;
		const t = e.changedTouches[0];
		const dx = t.clientX - this.touchStartX;
		const dy = t.clientY - this.touchStartY;
		const target = swipeToTarget(dx, dy, this.emptyIndex, this.gridSize, 30);
		if (target < 0) return;
		e.preventDefault();
		this.moveTile(target);
	}
}

// ---------------------------------------------------------------------------
// App-shell navigation layer
// ---------------------------------------------------------------------------

const SECTIONS = ["game", "rules", "options", "about"];

const showView = (view) => {
	for (const id of SECTIONS) {
		const el = document.getElementById(`view-${id}`);
		if (el) el.hidden = id !== view;
	}
};

const openPanel = () => {
	document.getElementById("side-panel").classList.add("open");
	document.getElementById("panel-overlay").hidden = false;
};

const closePanel = () => {
	document.getElementById("side-panel").classList.remove("open");
	document.getElementById("panel-overlay").hidden = true;
};

const updateHeaderBadge = (gridSize) => {
	const badge = document.getElementById("app-header-badge");
	if (badge) badge.textContent = `${gridSize}×${gridSize}`;
};

const syncOptionsView = (game) => {
	// Sync diff-btn active state in Options
	document.querySelectorAll(".diff-btn").forEach((btn) => {
		const isActive = parseInt(btn.dataset.size, 10) === game.gridSize;
		btn.classList.toggle("active", isActive);
		btn.setAttribute("aria-pressed", isActive ? "true" : "false");
	});
	// Sync number toggle
	const ntBtn = document.getElementById("numberToggleBtn");
	if (ntBtn) {
		ntBtn.classList.toggle("active", game.showNumbers);
		ntBtn.setAttribute("aria-pressed", game.showNumbers ? "true" : "false");
	}
	// Sync seed input
	const seedInput = document.getElementById("seedInput");
	if (seedInput) seedInput.value = game.shuffleSeed;
	// Sync best score display in options
	const bestOpts = document.getElementById("bestMovesTodayOpts");
	if (bestOpts) {
		bestOpts.textContent = game.bestMovesToday > 0 ? String(game.bestMovesToday) : "—";
	}
};

const initNavigation = (game) => {
	// Header badge initial state
	updateHeaderBadge(game.gridSize);

	// Patch setDifficulty to also update the badge and options view
	const origSetDifficulty = game.setDifficulty.bind(game);
	game.setDifficulty = (size) => {
		origSetDifficulty(size);
		updateHeaderBadge(game.gridSize);
		// Keep options diff-btns in sync when called from the game view sidebar
		document.querySelectorAll(".diff-btn").forEach((b) => {
			const isActive = parseInt(b.dataset.size, 10) === game.gridSize;
			b.classList.toggle("active", isActive);
			b.setAttribute("aria-pressed", isActive ? "true" : "false");
		});
		const bestOpts = document.getElementById("bestMovesTodayOpts");
		if (bestOpts) {
			bestOpts.textContent = game.bestMovesToday > 0 ? String(game.bestMovesToday) : "—";
		}
	};

	// Patch resetBestScore to also update options display
	const origResetBestScore = game.resetBestScore.bind(game);
	game.resetBestScore = () => {
		origResetBestScore();
		const bestOpts = document.getElementById("bestMovesTodayOpts");
		if (bestOpts) bestOpts.textContent = "—";
	};

	// Patch resetSettings to also sync options view and badge
	const origResetSettings = game.resetSettings.bind(game);
	game.resetSettings = () => {
		origResetSettings();
		syncOptionsView(game);
		updateHeaderBadge(game.gridSize);
	};

	// Menu open/close
	document.getElementById("btn-menu").addEventListener("click", () => {
		syncOptionsView(game);
		openPanel();
	});
	document.getElementById("btn-panel-close").addEventListener("click", () => {
		closePanel();
		showView("game");
	});
	document.getElementById("panel-overlay").addEventListener("click", closePanel);

	// Panel navigation
	document.getElementById("nav-new").addEventListener("click", () => {
		closePanel();
		showView("game");
		if (game.isGameActive) game.shuffleTiles();
	});
	document.getElementById("nav-rules").addEventListener("click", () => {
		closePanel();
		showView("rules");
	});
	document.getElementById("nav-options").addEventListener("click", () => {
		syncOptionsView(game);
		closePanel();
		showView("options");
	});
	document.getElementById("nav-about").addEventListener("click", () => {
		closePanel();
		showView("about");
	});

	// Back buttons
	document.querySelectorAll("[data-nav-back='game']").forEach((btn) => {
		btn.addEventListener("click", () => showView("game"));
	});

	// Options OK
	document.getElementById("btn-options-ok").addEventListener("click", () => {
		showView("game");
	});

	// Keyboard: Escape closes panel / goes back to game
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			if (!document.getElementById("panel-overlay").hidden) {
				closePanel();
			} else {
				showView("game");
			}
		}
	});
};

const registerServiceWorker = async () => {
	if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

	try {
		const registration = await navigator.serviceWorker.register("./sw.js", {
			scope: "./",
		});

		if (registration.waiting) {
			registration.waiting.postMessage({ type: "SKIP_WAITING" });
		}

		registration.addEventListener("updatefound", () => {
			const worker = registration.installing;
			if (!worker) return;

			worker.addEventListener("statechange", () => {
				if (
					worker.state === "installed" &&
					navigator.serviceWorker.controller
				) {
					worker.postMessage({ type: "SKIP_WAITING" });
				}
			});
		});
	} catch (error) {
		console.warn("Service worker registration failed:", error);
	}
};

const initPwaSupport = (game) => {
	const installBtn = document.getElementById("nav-install");
	if (!installBtn) return;

	let deferredInstallPrompt = null;
	const displayModeMedia = window.matchMedia("(display-mode: standalone)");

	const isStandalone = () =>
		displayModeMedia.matches || window.navigator.standalone === true;

	const syncInstallButton = () => {
		installBtn.hidden = isStandalone() || !deferredInstallPrompt;
	};

	window.addEventListener("beforeinstallprompt", (event) => {
		event.preventDefault();
		deferredInstallPrompt = event;
		syncInstallButton();
	});

	window.addEventListener("appinstalled", () => {
		deferredInstallPrompt = null;
		syncInstallButton();
		game.setStatus("Tiles Puzzle installed successfully.", "#27ae60");
	});

	const onDisplayModeChange = () => {
		if (isStandalone()) deferredInstallPrompt = null;
		syncInstallButton();
	};

	if (typeof displayModeMedia.addEventListener === "function") {
		displayModeMedia.addEventListener("change", onDisplayModeChange);
	} else if (typeof displayModeMedia.addListener === "function") {
		displayModeMedia.addListener(onDisplayModeChange);
	}

	installBtn.addEventListener("click", async () => {
		if (!deferredInstallPrompt) {
			game.setStatus(
				"Install prompt is not available right now. Keep using the app and try again.",
			);
			return;
		}

		const promptEvent = deferredInstallPrompt;
		deferredInstallPrompt = null;

		await promptEvent.prompt();
		const choice = await promptEvent.userChoice;

		if (choice?.outcome === "accepted") {
			game.setStatus("Installing Tiles Puzzle...");
		} else {
			game.setStatus("Installation canceled.");
		}

		syncInstallButton();
	});

	syncInstallButton();
	registerServiceWorker();
};

// Initialize game and navigation
const _game = new PuzzleGame();
initNavigation(_game);
initPwaSupport(_game);
