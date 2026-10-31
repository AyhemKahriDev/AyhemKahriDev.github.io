const CACHE_VERSION = "tiles-puzzle-v1";
const APP_SHELL_CACHE = `${CACHE_VERSION}-app-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL_ASSETS = [
	"./",
	"./index.html",
	"./manifest.json",
	"./manifest.webapp",
	"./manifest_hosted.webapp",
	"./css/tiles_puzzle.css",
	"./js/tiles_puzzle.js",
	"./js/board.js",
	"./js/input.js",
	"./js/storage.js",
	"./js/view.js",
	"./image/tiles_puzzle_4x4_tile_map.jpg",
	"./image/oliver_garda_ferrata_colodri_arco.jpg",
	"./image/icons/icon-bars.svg",
	"./image/icons/icon-delete.svg",
	"./image/icons/tiles_puzzle32.png",
	"./image/icons/tiles_puzzle48.png",
	"./image/icons/tiles_puzzle60.png",
	"./image/icons/tiles_puzzle64.png",
	"./image/icons/tiles_puzzle90.png",
	"./image/icons/tiles_puzzle120.png",
	"./image/icons/tiles_puzzle128.png",
	"./image/icons/tiles_puzzle256.png",
];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_ASSETS)),
	);
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const cacheNames = await caches.keys();
			await Promise.all(
				cacheNames
					.filter((name) => !name.startsWith(CACHE_VERSION))
					.map((name) => caches.delete(name)),
			);
			await self.clients.claim();
		})(),
	);
});

self.addEventListener("message", (event) => {
	if (event.data?.type === "SKIP_WAITING") {
		self.skipWaiting();
	}
});

const isNavigationRequest = (request) => request.mode === "navigate";

const isSameOriginGet = (request) => {
	if (request.method !== "GET") return false;
	const url = new URL(request.url);
	return url.origin === self.location.origin;
};

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (!isSameOriginGet(request)) return;

	if (isNavigationRequest(request)) {
		event.respondWith(
			(async () => {
				try {
					const network = await fetch(request);
					const cache = await caches.open(RUNTIME_CACHE);
					cache.put(request, network.clone());
					return network;
				} catch {
					const cached = await caches.match(request);
					if (cached) return cached;
					return caches.match("./index.html");
				}
			})(),
		);
		return;
	}

	event.respondWith(
		(async () => {
			const cached = await caches.match(request);
			if (cached) return cached;

			const network = await fetch(request);
			if (!network || network.status !== 200 || network.type !== "basic") {
				return network;
			}

			const cache = await caches.open(RUNTIME_CACHE);
			cache.put(request, network.clone());
			return network;
		})(),
	);
});
