from pathlib import Path

path = Path("scripts/validate-loading.mjs")
text = path.read_text()
replacements = {
    'requireText(\'{ resources: ["background"] }\', "background-only unit-home loading");': 'requireText(\'{ resources: ["background"], uiModules: ["content"] }\', "background-only unit-home loading with lazy content UI");',
    'requireText(\'{ resources: ["text"] }\', "text-only route loading");': 'requireText(\'{ resources: ["text"], uiModules: ["content"] }\', "text-only route loading with lazy content UI");',
    'requireText(\'{ resources: ["structure"] }\', "structure-only route loading");': 'requireText(\'{ resources: ["structure"], uiModules: ["content"] }\', "structure-only route loading with lazy content UI");',
    'requireText(\'{ resources: ["appreciation"] }\', "appreciation-only route loading");': 'requireText(\'{ resources: ["appreciation"], uiModules: ["content"] }\', "appreciation-only route loading with lazy content UI");',
    'requireText(\'{ resources: ["memorisation"] }\', "memorisation-only route loading");': 'requireText(\'{ resources: ["memorisation"], uiModules: ["memorisation"] }\', "memorisation-only route loading with lazy memorisation UI");',
    'requireText(\'{ resources: ["rubrics"], banks: [bankName] }\', "single-bank quiz loading with rubric support");': 'requireText(\'{ resources: ["rubrics"], banks: [bankName], uiModules: ["questions"] }\', "single-bank quiz loading with rubric support and lazy question UI");',
    'requireText(\'{ resources: ["rubrics"], banks: ["cross-text"] }\', "cross-text bank loading with rubric support");': 'requireText(\'{ resources: ["rubrics"], banks: ["cross-text"], uiModules: ["questions"] }\', "cross-text bank loading with rubric support and lazy question UI");',
    'requireText(\'{ resources: ["memorisation", "rubrics"], allQuestionBanks: true }\', "aggregate progress loading with memorisation and rubrics");': 'requireText(\'{ resources: ["memorisation", "rubrics"], allQuestionBanks: true, uiModules: ["content"] }\', "aggregate progress loading with memorisation, rubrics and lazy content UI");'
}
for old, new in replacements.items():
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"validator mapping: expected 1 match for {old!r}, found {count}")
    text = text.replace(old, new, 1)
path.write_text(text)
