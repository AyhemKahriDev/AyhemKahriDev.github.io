const path = require("node:path");
const { defineConfig } = require("@playwright/test");

const nodeExecutable = process.execPath;
const httpServerCli = path.join(
	__dirname,
	"node_modules",
	"http-server",
	"bin",
	"http-server",
);

const srcDir = path.join(__dirname, "javascript", "html5", "src");

module.exports = defineConfig({
	testDir: path.join(srcDir, "tests"),
	timeout: 30000,
	expect: {
		timeout: 5000,
	},
	fullyParallel: true,
	retries: 0,
	reporter: [
		["list"],
		["html", { open: "never", outputFolder: "playwright-report" }],
	],
	use: {
		baseURL: "http://127.0.0.1:4173",
		headless: true,
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	webServer: {
		command: `"${nodeExecutable}" "${httpServerCli}" "${srcDir}" -p 4173 -c-1 --silent`,
		url: "http://127.0.0.1:4173",
		reuseExistingServer: true,
		timeout: 30000,
	},
});
