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

for (const key of ["style", "contentStyle", "questionsStyle", "progress", "router", "app", "content", "questions", "memorisation"]) {
  check(!!asset(key), `asset manifest is missing ${key}`);
  check(/^\/assets\/build\/[a-z0-9-]+\.[0-9a-f]{12}\.(?:js|css)$/.test(asset(key)?.path || ""), `${key} must use a content-hashed runtime URL`);
}

const scriptTags = [...index.matchAll(/<script\s+([^>]*?)src="([^"]+)"([^>]*)><\/script>/g)].map((m) => ({ attrs: `${m[1]} ${m[3]}`, src: m[2] }));
const startupScripts = scriptTags.map((s) => s.src);
const expectedStartup = [asset("progress")?.path, asset("router")?.path, asset("app")?.path];
check(JSON.stringify(startupScripts) === JSON.stringify(expectedStartup), "startup scripts must be exactly the fingerprinted progress, router and app assets");
check(scriptTags.every((s) => /\bdefer\b/.test(s.attrs)), "all startup scripts must use defer");
check(index.includes(`href="${asset("style")?.path}"`), "index must use the fingerprinted core stylesheet");
check(!index.includes(asset("contentStyle")?.path || "__missing__"), "content stylesheet must remain route-lazy");
check(!index.includes(asset("questionsStyle")?.path || "__missing__"), "question stylesheet must remain route-lazy");
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
  check(builtApp.includes("function loadStyleCached(href)"), "built app must cache route-only stylesheet requests");
  check(builtApp.includes(`content: { script: "${asset("content")?.path}", style: "${asset("contentStyle")?.path}" }`), "built app must pair content renderer with its lazy stylesheet");
  check(builtApp.includes(`questions: { script: "${asset("questions")?.path}", style: "${asset("questionsStyle")?.path}" }`), "built app must pair question engine with its lazy stylesheet");
  check(builtApp.includes(`memorisation: "${asset("memorisation")?.path}"`), "built app must point to fingerprinted memorisation engine");
}

check(headers.includes("/assets/build/*"), "Cloudflare headers must target fingerprinted build assets");
check(headers.includes("Cache-Control: public, max-age=31536000, immutable"), "fingerprinted assets must receive a one-year immutable browser cache");
check(headers.includes("/\n  Cache-Control: no-cache"), "HTML root must remain revalidatable/no-cache");
check(headers.includes("/index.html\n  Cache-Control: no-cache"), "index.html must remain revalidatable/no-cache");
check(headers.includes("rel=preload; as=style"), "Cloudflare Early Hints must preload the fingerprinted core stylesheet");
for (const key of ["style", "progress", "router", "app"]) {
  check(headers.includes(`<${asset(key)?.path}>`), `_headers must hint fingerprinted ${key}`);
}
check(!headers.includes(`<${asset("contentStyle")?.path}>`), "route-lazy content CSS must not be preloaded on every page");
check(!headers.includes(`<${asset("questionsStyle")?.path}>`), "route-lazy question CSS must not be preloaded on every page");

const eagerFiles = ["progress", "router", "app"].map(fileFromAsset).filter(Boolean);
const deferredFiles = ["content", "questions", "memorisation"].map(fileFromAsset).filter(Boolean);
const eagerBytes = eagerFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);
const deferredBytes = deferredFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);
const previousBytes = eagerBytes + deferredBytes;
const reduction = Math.round((1 - eagerBytes / previousBytes) * 1000) / 10;
check(eagerBytes <= 50000, `startup JavaScript budget exceeded: ${eagerBytes} bytes > 50000 bytes`);

const coreCssFile = fileFromAsset("style");
const coreCssBytes = coreCssFile && fs.existsSync(coreCssFile) ? fs.statSync(coreCssFile).size : Infinity;
const sourceCssBytes = fs.statSync("css/style.css").size;
const lazyCssBytes = ["contentStyle", "questionsStyle"].map(fileFromAsset).filter(Boolean)
  .reduce((sum, file) => sum + (fs.existsSync(file) ? fs.statSync(file).size : 0), 0);
const cssReduction = Number.isFinite(coreCssBytes) ? Math.round((1 - coreCssBytes / sourceCssBytes) * 1000) / 10 : 0;
check(coreCssBytes < sourceCssBytes, `core stylesheet must be smaller than the ${sourceCssBytes}-byte source bundle`);
check(coreCssBytes <= 80000, `startup core CSS budget exceeded: ${coreCssBytes} bytes > 80000 bytes`);
check(lazyCssBytes > 0, "route-lazy CSS assets must contain extracted route styles");

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}

console.log(`Initial-load contract validated: ${eagerBytes} raw JS bytes eager, ${deferredBytes} bytes route-lazy (${reduction}% less eager JS than the former six-script bootstrap); core CSS ${coreCssBytes}/${sourceCssBytes} bytes (${cssReduction}% removed from startup) with ${lazyCssBytes} route-lazy CSS bytes; versioned assets use one-year immutable caching.`);
