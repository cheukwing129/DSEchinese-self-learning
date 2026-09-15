import fs from "node:fs";

const files = {
  app: fs.readFileSync("js/app.js", "utf8"),
  questions: fs.readFileSync("js/question-engine.js", "utf8"),
  content: fs.readFileSync("js/content-renderer.js", "utf8"),
  memorisation: fs.readFileSync("js/memorisation-engine.js", "utf8"),
  index: fs.readFileSync("index.html", "utf8"),
  css: fs.readFileSync("css/style.css", "utf8")
};

const errors = [];

function requireMatch(label, text, pattern) {
  if (!pattern.test(text)) errors.push(`${label}: required accessibility pattern not found`);
}

function forbidMatch(label, text, pattern) {
  if (pattern.test(text)) errors.push(`${label}: non-semantic interactive pattern found`);
}

forbidMatch("Question choices", files.questions, /<div class=\"option-item/);
forbidMatch("Annotation terms", files.content, /<span class=\"term\"[^>]*data-anno/);
forbidMatch("Reorder choices", files.memorisation, /<span class=\"reorder-chip\"[^>]*data-chip/);

requireMatch("Single-choice semantics", files.questions, /role=\"radiogroup\"/);
requireMatch("Toggle state semantics", files.questions, /aria-pressed=/);
requireMatch("Answer feedback live region", files.questions, /id=\"reveal-slot\"[^>]*aria-live=\"polite\"/);
requireMatch("Keyboard focus restoration", files.questions, /restoreChoiceFocus\(/);
requireMatch("Annotation button", files.content, /<button type=\"button\" class=\"term\"/);
requireMatch("Annotation dialog", files.content, /setAttribute\(\"role\", \"dialog\"\)/);
requireMatch("Reorder button", files.memorisation, /<button type=\"button\" class=\"reorder-chip\"[^>]*data-chip/);
requireMatch("Semantic home link", files.index, /<a class=\"brand\"[^>]*href=\"#\/\"/);
requireMatch("Visible keyboard focus", files.css, /:focus-visible/);
requireMatch("Touch target sizing", files.css, /min-height:\s*44px/);
requireMatch("Mobile header touch target", files.index, /@media\s*\(max-width:\s*600px\)\s*\{\s*\.header-nav-link\s*\{\s*min-height:\s*44px/s);
requireMatch("Skip-link hash protection", files.app, /skipLink\.addEventListener\("click"[\s\S]*?event\.preventDefault\(\)[\s\S]*?main\.focus/);
requireMatch("SPA route focus management", files.app, /pendingRouteFocus[\s\S]*?focusPrimaryContent\(\)/);
requireMatch("Reader roving tab stop", files.content, /role=\"tab\"[\s\S]*?tabindex=\"\$\{i === activeIndex \? \"0\" : \"-1\"\}\"/);
requireMatch("Reader arrow-key tabs", files.content, /ArrowRight[\s\S]*?ArrowLeft[\s\S]*?Home[\s\S]*?End/);

if (errors.length) {
  console.error("Accessibility validation failed:\n" + errors.map((e) => `- ${e}`).join("\n"));
  process.exit(1);
}

console.log("Accessibility interaction validation passed: semantic controls, live feedback, focus visibility, touch targets and keyboard-flow guards are present.");
