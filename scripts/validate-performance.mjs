import fs from "node:fs";

const errors = [];
const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");
const css = fs.readFileSync("css/style.css", "utf8");
const headers = fs.readFileSync("_headers", "utf8");

function check(condition, message) {
  if (!condition) errors.push(message);
}

check(!index.includes("fonts.googleapis.com") && !index.includes("fonts.gstatic.com"), "initial HTML must not depend on Google Fonts");
check(!css.includes('"Mulish"') && !css.includes('"Source Serif Pro"'), "CSS must use local/system font stacks");

const scriptTags = [...index.matchAll(/<script\s+([^>]*?)src="([^"]+)"([^>]*)><\/script>/g)].map((m) => ({ attrs: `${m[1]} ${m[3]}`, src: m[2] }));
const startupScripts = scriptTags.map((s) => s.src);
const expectedStartup = ["js/progress.js", "js/router.js", "js/app.js"];
check(JSON.stringify(startupScripts) === JSON.stringify(expectedStartup), `startup scripts must be exactly ${expectedStartup.join(", ")}`);
check(scriptTags.every((s) => /\bdefer\b/.test(s.attrs)), "all startup scripts must use defer");
for (const heavy of ["js/content-renderer.js", "js/question-engine.js", "js/memorisation-engine.js"]) {
  check(!startupScripts.includes(heavy), `${heavy} must remain route-lazy`);
}

check(app.includes("function loadScriptCached(src)"), "App must cache route-only script requests");
check(app.includes("function loadUIModules(names = [])"), "App must expose route UI module loading");
check(app.includes('content: "js/content-renderer.js"'), "content renderer must be dynamically mapped");
check(app.includes('questions: "js/question-engine.js"'), "question engine must be dynamically mapped");
check(app.includes('memorisation: "js/memorisation-engine.js"'), "memorisation engine must be dynamically mapped");
check(app.includes('loadUIModules(["content"])'), "cross-unit overview must load content UI on demand");
check(app.includes('loadUIModules(["questions"])'), "cross-unit retry must load question UI on demand");
check(app.includes('uiModules: ["memorisation"]'), "memorisation route must load its engine on demand");
check(app.includes('uiModules: ["questions"]'), "quiz routes must load question engine on demand");
check(app.includes('uiModules: ["content"]'), "content routes must load content renderer on demand");

check(headers.includes("rel=preload; as=style"), "Cloudflare Early Hints must preload the stylesheet");
for (const src of expectedStartup) check(headers.includes(`<\/${src}>`) || headers.includes(`<${src.startsWith('/') ? src : '/' + src}>`), `_headers must hint ${src}`);
check(!/Cache-Control:\s*[^\n]*max-age=(?:[1-9]\d{4,}|31536000)/i.test(headers), "do not apply aggressive browser caching to unversioned CSS/JS/data assets");

const eagerBytes = expectedStartup.reduce((sum, file) => sum + fs.statSync(file).size, 0);
const deferredFiles = ["js/content-renderer.js", "js/question-engine.js", "js/memorisation-engine.js"];
const deferredBytes = deferredFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);
const previousBytes = eagerBytes + deferredBytes;
const reduction = Math.round((1 - eagerBytes / previousBytes) * 1000) / 10;
check(eagerBytes <= 50000, `startup JavaScript budget exceeded: ${eagerBytes} bytes > 50000 bytes`);

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}

console.log(`Initial-load contract validated: ${eagerBytes} raw JS bytes eager, ${deferredBytes} bytes route-lazy (${reduction}% less eager JS than the previous six-script bootstrap), with zero third-party font origins.`);
