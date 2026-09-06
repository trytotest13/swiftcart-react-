// run-audit.mjs
// Drives browser.mjs to audit design consistency
import { chromium } from 'playwright';
import audit from './design-audit.js';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const results = await audit(page);
console.log(JSON.stringify(results, null, 2));

await browser.close();
