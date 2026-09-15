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

const style = fingerprint("style", "css", "css/style.css", read("css/style.css"));
const progress = fingerprint("progress", "js", "js/progress.js", read("js/progress.js"));
const router = fingerprint("router", "js", "js/router.js", read("js/router.js"));
const content = fingerprint("content-renderer", "js", "js/content-renderer.js", read("js/content-renderer.js"));
const questions = fingerprint("question-engine", "js", "js/question-engine.js", read("js/question-engine.js"));
const memorisation = fingerprint("memorisation-engine", "js", "js/memorisation-engine.js", read("js/memorisation-engine.js"));

let builtApp = read("js/app.js");
builtApp = replaceOnce(
  builtApp,
  'content: "js/content-renderer.js"',
  `content: "${content.path}"`,
  "content renderer fingerprint injection"
);
builtApp = replaceOnce(
  builtApp,
  'questions: "js/question-engine.js"',
  `questions: "${questions.path}"`,
  "question engine fingerprint injection"
);
builtApp = replaceOnce(
  builtApp,
  'memorisation: "js/memorisation-engine.js"',
  `memorisation: "${memorisation.path}"`,
  "memorisation engine fingerprint injection"
);
const app = fingerprint("app", "js", "js/app.js", builtApp);

const assets = { style, progress, router, app, content, questions, memorisation };
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
