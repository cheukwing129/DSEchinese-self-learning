import fs from "node:fs";

const errors = [];
const index = fs.readFileSync("index.html", "utf8");
const sourceApp = fs.readFileSync("js/app.js", "utf8");
const css = fs.readFileSync("css/style.css", "utf8");
const headers = fs.readFileSync("_headers", "utf8");
const manifest = JSON.parse(fs.readFileSync("assets/build/asset-manifest.json", "utf8"));

function check(condition, message) {
  if (!condition) errors.push(message);
}

function asset(key) {
  return manifest.assets?.[key];
}

function fileFromAsset(key) {
  const item = asset(key);
  return item?.path?.startsWith("/") ? item.path.slice(1) : item?.path;
}

check(!index.includes("fonts.googleapis.com") && !index.includes("fonts.gstatic.com"), "initial HTML must not depend on Google Fonts");
check(!css.includes('"Mulish"') && !css.includes('"Source Serif Pro"'), "CSS must use local/system font stacks");

for (const key of ["style", "progress", "router", "app", "content", "questions", "memorisation"]) {
  check(!!asset(key), `asset manifest is missing ${key}`);
  check(/^\/assets\/build\/[a-z0-9-]+\.[0-9a-f]{12}\.(?:js|css)$/.test(asset(key)?.path || ""), `${key} must use a content-hashed runtime URL`);
}

const scriptTags = [...index.matchAll(/<script\s+([^>]*?)src="([^"]+)"([^>]*)><\/script>/g)].map((m) => ({ attrs: `${m[1]} ${m[3]}`, src: m[2] }));
const startupScripts = scriptTags.map((s) => s.src);
const expectedStartup = [asset("progress")?.path, asset("router")?.path, asset("app")?.path];
check(JSON.stringify(startupScripts) === JSON.stringify(expectedStartup), "startup scripts must be exactly the fingerprinted progress, router and app assets");
check(scriptTags.every((s) => /\bdefer\b/.test(s.attrs)), "all startup scripts must use defer");
check(index.includes(`href="${asset("style")?.path}"`), "index must use the fingerprinted stylesheet");
for (const heavyKey of ["content", "questions", "memorisation"]) {
  check(!startupScripts.includes(asset(heavyKey)?.path), `${heavyKey} engine must remain route-lazy`);
}

check(sourceApp.includes("function loadScriptCached(src)"), "App must cache route-only script requests");
check(sourceApp.includes("function loadUIModules(names = [])"), "App must expose route UI module loading");
check(sourceApp.includes('uiModules: ["memorisation"]'), "memorisation route must load its engine on demand");
check(sourceApp.includes('uiModules: ["questions"]'), "quiz routes must load question engine on demand");
check(sourceApp.includes('uiModules: ["content"]'), "content routes must load content renderer on demand");

const builtAppPath = fileFromAsset("app");
if (builtAppPath && fs.existsSync(builtAppPath)) {
  const builtApp = fs.readFileSync(builtAppPath, "utf8");
  check(builtApp.includes(`content: "${asset("content")?.path}"`), "built app must point to fingerprinted content renderer");
  check(builtApp.includes(`questions: "${asset("questions")?.path}"`), "built app must point to fingerprinted question engine");
  check(builtApp.includes(`memorisation: "${asset("memorisation")?.path}"`), "built app must point to fingerprinted memorisation engine");
}

check(headers.includes("/assets/build/*"), "Cloudflare headers must target fingerprinted build assets");
check(headers.includes("Cache-Control: public, max-age=31536000, immutable"), "fingerprinted assets must receive a one-year immutable browser cache");
check(headers.includes("/\n  Cache-Control: no-cache"), "HTML root must remain revalidatable");
check(headers.includes("/index.html\n  Cache-Control: no-cache"), "index.html must remain revalidatable");
check(headers.includes("rel=preload; as=style"), "Cloudflare Early Hints must preload the fingerprinted stylesheet");
for (const key of ["style", "progress", "router", "app"]) {
  check(headers.includes(`<${asset(key)?.path}>`), `_headers must hint fingerprinted ${key}`);
}

const eagerFiles = ["progress", "router", "app"].map(fileFromAsset).filter(Boolean);
const deferredFiles = ["content", "questions", "memorisation"].map(fileFromAsset).filter(Boolean);
const eagerBytes = eagerFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);
const deferredBytes = deferredFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);
const previousBytes = eagerBytes + deferredBytes;
const reduction = Math.round((1 - eagerBytes / previousBytes) * 1000) / 10;
check(eagerBytes <= 50000, `startup JavaScript budget exceeded: ${eagerBytes} bytes > 50000 bytes`);

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}

console.log(`Initial-load contract validated on fingerprinted assets: ${eagerBytes} raw JS bytes eager, ${deferredBytes} bytes route-lazy (${reduction}% less eager JS than the former six-script bootstrap), with one-year immutable caching for versioned assets.`);
