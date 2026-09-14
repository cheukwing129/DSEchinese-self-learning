import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
await fs.mkdir('ui-preview', { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  await desktop.goto(`${base}/#/`, { waitUntil: 'networkidle' });
  await desktop.locator('.home-title').waitFor();
  await desktop.screenshot({ path: 'ui-preview/home-desktop.png', fullPage: true });
  await desktop.locator('.map-card[href]').first().click();
  await desktop.locator('.unit-title').waitFor();
  await desktop.screenshot({ path: 'ui-preview/unit-desktop.png', fullPage: true });
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await mobile.goto(`${base}/#/`, { waitUntil: 'networkidle' });
  await mobile.locator('.home-title').waitFor();
  await mobile.screenshot({ path: 'ui-preview/home-mobile.png', fullPage: true });
  await mobile.locator('.map-card[href]').first().click();
  await mobile.locator('.unit-title').waitFor();
  await mobile.screenshot({ path: 'ui-preview/unit-mobile.png', fullPage: true });
  await mobile.close();
} finally {
  await browser.close();
}
console.log('Captured desktop and mobile UI previews.');
