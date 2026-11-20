// Loads the pure ECON block (between the ECON markers) out of index.html so tests and the sim run the real formulas.
import { readFileSync } from 'node:fs';
const NAMES = ['TIERS','EMB','goal','stageMult','coinCap','coinCost','padCost','lvCost','speedCost','mergeCost','chipsTotal','chipGain','chipMult','speedTotal','speedSplit','SHOP','shopCost','bounceMult','AUTO_IV','PRESTIGE_STAGE','FEVER_DUR','FEVER_CD','SPEED_CAP','SPEED_MAX','PAD_LV_MAX','CHIP_K','CHIP_BONUS','migrate','fmt'];
export function loadEcon() {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const a = html.indexOf('/*ECON*/'), b = html.indexOf('/*ENDECON*/');
  if (a < 0 || b < a) throw new Error('ECON markers not found in index.html');
  /* same realm (not vm) so arrays/objects compare equal in assert.deepStrictEqual */
  return new Function(html.slice(a, b) + `;return {${NAMES.join(',')}};`)();
}
