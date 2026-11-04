// v59.70 (S12): the screener page is split into src/ui/pages/screener/*.js behind the src/ui/pages/screener.js facade.
// Source contracts that read "the screener page" read every file of it as one text, in a fixed order.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SCREENER_PAGE_FILES = Object.freeze([
  'src/ui/pages/screener.js',
  'src/ui/pages/screener/model.js',
  'src/ui/pages/screener/filters.js',
  'src/ui/pages/screener/table.js',
  'src/ui/pages/screener/views.js',
  'src/ui/pages/screener/validation-tab.js',
  'src/ui/pages/screener/inspector.js',
  'src/ui/pages/screener/workbench.js',
  'src/ui/pages/screener/page.js'
]);

export function readScreenerPageSource(root = repoRoot) {
  return SCREENER_PAGE_FILES.map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
}
