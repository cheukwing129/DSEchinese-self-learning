import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const buildDir = path.join(root, "assets", "build");
const HASH_LENGTH = 12;

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function fingerprint(baseName, ext, sourcePath, content) {
  const fullHash = sha256(content);
  const shortHash = fullHash.slice(0, HASH_LENGTH);
  const fileName = `${baseName}.${shortHash}.${ext}`;
  return {
    source: sourcePath,
    hash: shortHash,
    sha256: fullHash,
    fileName,
    path: `/assets/build/${fileName}`,
    content
  };
}

function replaceOnce(text, oldValue, newValue, label) {
  const first = text.indexOf(oldValue);
  const last = text.lastIndexOf(oldValue);
  if (first < 0 || first !== last) {
    throw new Error(`${label}: expected exactly one occurrence of ${JSON.stringify(oldValue)}`);
  }
  return text.slice(0, first) + newValue + text.slice(first + oldValue.length);
}

function uniqueMarkerIndex(source, marker, label) {
  const first = source.indexOf(marker);
  const last = source.lastIndexOf(marker);
  if (first < 0 || first !== last) {
    throw new Error(`${label}: expected exactly one CSS marker ${JSON.stringify(marker)}`);
  }
  return first;
}

function splitRouteStyles(source) {
  const quizMarker = "/* ===== Quiz UI 2.0: focused answering workspace ===== */";
  const progressMarker = "/* ===== Progress UI 2.0: learning decisions before dashboards ===== */";
  const readerMarker = "/* ===== Reader UI 2.0: modern Chinese text workspace ===== */";
  const studyMarker = "/* ===== Content Study UI 2.0: words / comprehension / analysis / theme ===== */";
  const launchMarker = "/* ============================================================\n   Launch polish — 品牌 chrome、狀態頁、mobile header、motion";

  const quizStart = uniqueMarkerIndex(source, quizMarker, "quiz CSS split");
  const progressStart = uniqueMarkerIndex(source, progressMarker, "progress CSS split");
  const readerStart = uniqueMarkerIndex(source, readerMarker, "reader CSS split");
  const studyStart = uniqueMarkerIndex(source, studyMarker, "content-study CSS split");
  const launchStart = uniqueMarkerIndex(source, launchMarker, "launch polish CSS split");

  if (!(quizStart < progressStart && progressStart < readerStart && readerStart < studyStart && studyStart < launchStart)) {
    throw new Error("route CSS markers are out of the expected cascade order");
  }

  const launchPolish = source.slice(launchStart);
  const core = source.slice(0, quizStart) + launchPolish;
  const questions = source.slice(quizStart, progressStart) + "\n\n" + launchPolish;
  const progress = source.slice(progressStart, readerStart) + "\n\n" + launchPolish;
  const reader = source.slice(readerStart, studyStart) + "\n\n" + launchPolish;
  const study = source.slice(studyStart, launchStart) + "\n\n" + launchPolish;

  return { core, questions, progress, reader, study };
}

const styleSource = read("css/style.css");
const splitStyles = splitRouteStyles(styleSource);
const style = fingerprint("style", "css", "css/style.css", splitStyles.core);
const readerStyle = fingerprint("reader-style", "css", "css/style.css", splitStyles.reader);
const studyStyle = fingerprint("study-style", "css", "css/style.css", splitStyles.study);
const progressStyle = fingerprint("progress-style", "css", "css/style.css", splitStyles.progress);
const questionsStyle = fingerprint("questions-style", "css", "css/style.css", splitStyles.questions);
const progress = fingerprint("progress", "js", "js/progress.js", read("js/progress.js"));
const progressAnalytics = fingerprint("progress-analytics", "js", "js/progress-analytics.js", read("js/progress-analytics.js"));
const router = fingerprint("router", "js", "js/router.js", read("js/router.js"));
const content = fingerprint("content-renderer", "js", "js/content-renderer.js", read("js/content-renderer.js"));
const questions = fingerprint("question-engine", "js", "js/question-engine.js", read("js/question-engine.js"));
const memorisation = fingerprint("memorisation-engine", "js", "js/memorisation-engine.js", read("js/memorisation-engine.js"));

let builtApp = read("js/app.js");
builtApp = replaceOnce(
  builtApp,
  "const cache = { curriculum: null, json: {}, scripts: {} };",
  "const cache = { curriculum: null, json: {}, scripts: {}, styles: {} };",
  "route stylesheet cache injection"
);
builtApp = replaceOnce(
  builtApp,
  `  function loadUIModules(names = []) {\n    return Promise.all([...new Set(names)].map((name) => {\n      const src = UI_MODULES[name];\n      if (!src) return Promise.reject(new Error(\`未知介面模組「\${name}」。\`));\n      return loadScriptCached(src);\n    }));\n  }`,
  `  function loadStyleCached(href) {\n    if (!cache.styles[href]) {\n      cache.styles[href] = new Promise((resolve, reject) => {\n        const link = document.createElement("link");\n        link.rel = "stylesheet";\n        link.href = href;\n        link.dataset.uiStyle = href;\n        link.addEventListener("load", () => resolve(), { once: true });\n        link.addEventListener("error", () => {\n          delete cache.styles[href];\n          link.remove();\n          reject(new Error(\`無法載入介面樣式「\${href}」。\`));\n        }, { once: true });\n        document.head.appendChild(link);\n      });\n    }\n    return cache.styles[href];\n  }\n\n  function loadUIModules(names = []) {\n    return Promise.all([...new Set(names)].map((name) => {\n      const module = UI_MODULES[name];\n      if (!module) return Promise.reject(new Error(\`未知介面模組「\${name}」。\`));\n      const descriptor = typeof module === "string" ? { script: module, style: null } : module;\n      return Promise.all([\n        descriptor.style ? loadStyleCached(descriptor.style) : Promise.resolve(),\n        loadScriptCached(descriptor.script)\n      ]);\n    }));\n  }`,
  "route stylesheet loader injection"
);
builtApp = replaceOnce(
  builtApp,
  'content: "js/content-renderer.js"',
  `content: "${content.path}"`,
  "content renderer fingerprint injection"
);
builtApp = replaceOnce(
  builtApp,
  'contentReader: "js/content-renderer.js"',
  `contentReader: { script: "${content.path}", style: "${readerStyle.path}" }`,
  "reader renderer fingerprint injection"
);
builtApp = replaceOnce(
  builtApp,
  'contentStudy: "js/content-renderer.js"',
  `contentStudy: { script: "${content.path}", style: "${studyStyle.path}" }`,
  "study renderer fingerprint injection"
);
builtApp = replaceOnce(
  builtApp,
  'contentProgress: "js/content-renderer.js"',
  `contentProgress: { script: "${content.path}", style: "${progressStyle.path}" }`,
  "progress renderer fingerprint injection"
);
builtApp = replaceOnce(
  builtApp,
  'progressAnalytics: "js/progress-analytics.js"',
  `progressAnalytics: "${progressAnalytics.path}"`,
  "progress analytics fingerprint injection"
);
builtApp = replaceOnce(
  builtApp,
  'questions: "js/question-engine.js"',
  `questions: { script: "${questions.path}", style: "${questionsStyle.path}" }`,
  "question engine fingerprint injection"
);
builtApp = replaceOnce(
  builtApp,
  'memorisation: "js/memorisation-engine.js"',
  `memorisation: "${memorisation.path}"`,
  "memorisation engine fingerprint injection"
);
const app = fingerprint("app", "js", "js/app.js", builtApp);

const assets = { style, readerStyle, studyStyle, progressStyle, questionsStyle, progress, progressAnalytics, router, app, content, questions, memorisation };
const manifest = {
  version: 1,
  hashAlgorithm: `sha256-${HASH_LENGTH}`,
  assets: Object.fromEntries(Object.entries(assets).map(([key, asset]) => [key, {
    source: asset.source,
    path: asset.path,
    hash: asset.hash,
    sha256: asset.sha256
  }]))
};
const manifestText = JSON.stringify(manifest, null, 2) + "\n";

let index = read("index.template.html");
const placeholders = {
  "{{STYLE_ASSET}}": style.path,
  "{{PROGRESS_ASSET}}": progress.path,
  "{{ROUTER_ASSET}}": router.path,
  "{{APP_ASSET}}": app.path
};
for (const [placeholder, value] of Object.entries(placeholders)) {
  index = replaceOnce(index, placeholder, value, `index placeholder ${placeholder}`);
}
if (/\{\{[A-Z0-9_]+\}\}/.test(index)) {
  throw new Error("index.template.html contains an unresolved asset placeholder");
}

const preload = [
  `<${style.path}>; rel=preload; as=style`,
  `<${progress.path}>; rel=preload; as=script`,
  `<${router.path}>; rel=preload; as=script`,
  `<${app.path}>; rel=preload; as=script`
].join(", ");

const headersText = `/\n  Cache-Control: no-cache\n  Link: ${preload}\n\n/index.html\n  Cache-Control: no-cache\n  Link: ${preload}\n\n/assets/build/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/assets/audio/*\n  Cache-Control: public, max-age=86400, stale-while-revalidate=604800\n\n/assets/brand/*\n  Cache-Control: public, max-age=86400, stale-while-revalidate=604800\n\n/data/*\n  Cache-Control: no-cache\n`;

const expectedBuildFiles = new Map();
for (const asset of Object.values(assets)) expectedBuildFiles.set(asset.fileName, asset.content);
expectedBuildFiles.set("asset-manifest.json", manifestText);

function writeOutputs() {
  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(buildDir, { recursive: true });
  for (const [fileName, contentValue] of expectedBuildFiles) {
    fs.writeFileSync(path.join(buildDir, fileName), contentValue);
  }
  fs.writeFileSync(path.join(root, "index.html"), index);
  fs.writeFileSync(path.join(root, "_headers"), headersText);
  console.log(`Built ${expectedBuildFiles.size - 1} fingerprinted assets plus manifest.`);
}

function checkFile(relativePath, expected, errors) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    errors.push(`${relativePath} is missing`);
    return;
  }
  const actual = fs.readFileSync(fullPath, "utf8");
  if (actual !== expected) errors.push(`${relativePath} is stale; run node scripts/build-assets.mjs --write`);
}

function checkOutputs() {
  const errors = [];
  checkFile("index.html", index, errors);
  checkFile("_headers", headersText, errors);

  if (!fs.existsSync(buildDir)) {
    errors.push("assets/build is missing; run node scripts/build-assets.mjs --write");
  } else {
    const actualNames = fs.readdirSync(buildDir).filter((name) => fs.statSync(path.join(buildDir, name)).isFile()).sort();
    const expectedNames = [...expectedBuildFiles.keys()].sort();
    if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
      errors.push(`assets/build file set is stale; expected ${expectedNames.join(", ")}`);
    }
    for (const [fileName, expected] of expectedBuildFiles) {
      const fullPath = path.join(buildDir, fileName);
      if (!fs.existsSync(fullPath)) continue;
      const actual = fs.readFileSync(fullPath, "utf8");
      if (actual !== expected) errors.push(`assets/build/${fileName} does not match its source fingerprint`);
    }
  }

  for (const [key, asset] of Object.entries(assets)) {
    const builtPath = path.join(root, asset.path.slice(1));
    if (!fs.existsSync(builtPath)) continue;
    const actualHash = sha256(fs.readFileSync(builtPath)).slice(0, HASH_LENGTH);
    if (actualHash !== asset.hash) errors.push(`${key} filename hash does not match built content`);
  }

  if (errors.length) {
    errors.forEach((error) => console.error(`ERROR: ${error}`));
    process.exit(1);
  }
  console.log(`Fingerprint build is current: ${Object.keys(assets).length} assets, immutable cache-safe URLs, deterministic manifest.`);
}

const mode = process.argv[2] || "--check";
if (mode === "--write") writeOutputs();
else if (mode === "--check") checkOutputs();
else {
  console.error("Usage: node scripts/build-assets.mjs [--check|--write]");
  process.exit(2);
}
