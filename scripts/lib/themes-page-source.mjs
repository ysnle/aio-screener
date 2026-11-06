// v59.70: the themes page is split into src/ui/pages/themes/*.js behind the src/ui/pages/themes.js facade (lifecycle).
// Source contracts that read "the themes page" read every file of it as one text, in a fixed order.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const THEMES_PAGE_FILES = Object.freeze([
  'src/ui/pages/themes.js',
  'src/ui/pages/themes/shared.js',
  'src/ui/pages/themes/rrg.js',
  'src/ui/pages/themes/sectors.js',
  'src/ui/pages/themes/detail.js'
]);

export function readThemesPageSource(root = repoRoot) {
  return THEMES_PAGE_FILES.map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
}
