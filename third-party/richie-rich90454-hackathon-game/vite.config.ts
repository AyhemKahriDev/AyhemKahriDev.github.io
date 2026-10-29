import {defineConfig} from "vite";
import {readFileSync} from "fs";

let packageJson=JSON.parse(readFileSync(new URL("package.json", import.meta.url),"utf-8"));
let version=packageJson.version;

export default defineConfig({
	root: "src",
	// Relative asset URLs keep the built game working from a subfolder and from a local copy.
	base: "./",
	publicDir: "../public",
	build: {
		outDir: "../dist",
		emptyOutDir: true,
		assetsDir: "assets",
		minify: "oxc",
		target: "es6",
		cssMinify: true,
		chunkSizeWarningLimit: 2000,
		rolldownOptions: {
			// Both pages are built, otherwise the rules page is silently missing from dist.
			input: {
				index: "index.html",
				rules: "rules.html"
			},
			treeshake: true,
			output: {
				codeSplitting: true,
				manualChunks(id){
					if (id.includes("node_modules")){
						if (id.includes("node_modules/mathjs/")){
							let parts=id.split("node_modules/mathjs/")[1].split("/");
							return `vendor-mathjs-${parts[0]}`;
						}
						let parts=id.split("node_modules/")[1].split("/");
						let topLevel=parts[0];
						if (topLevel.startsWith("@")){
							let scoped=`${topLevel}/${parts[1]}`;
							return `vendor-${scoped.replace("@","")}`;
						}
						if (["tone"].includes(topLevel)){
							return `vendor-${topLevel}`;
						}
						return "vendor-other";
					}
				}
			}
		}
	},
	plugins: [
		{
			name: "inject-version",
			transformIndexHtml(html){
				return html.replace(/__APP_VERSION__/g, version);
			}
		}
	],
	server: {
		host: "::",
		port: 6008,
		open: false
	},
	preview: {
		host: "::",
		port: 6008,
		open: false
	}
});
