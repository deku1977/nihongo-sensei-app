import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KANJI_DB = path.join(__dirname, '..', 'src', 'database', 'kanji_master.json');
const SVG_DIR = path.join(__dirname, '..', 'public', 'kanji');
const KANJIVG_BASE = 'https://github.com/KanjiVG/kanjivg/raw/master/kanji';

/**
 * Converte un kanji in codepoint esadecimale a 5 cifre
 * @param {string} kanji - Carattere kanji
 * @returns {string} Codepoint (es. "04e00")
 */
function getCodepoint(kanji) {
  return kanji.charCodeAt(0).toString(16).padStart(5, '0');
}

/**
 * Scarica un file SVG da KanjiVG
 * @param {string} codepoint - Codepoint esadecimale
 * @returns {Promise<boolean>} Success
 */
async function downloadSVG(codepoint) {
  const url = `${KANJIVG_BASE}/${codepoint}.svg`;
  const dest = path.join(SVG_DIR, `${codepoint}.svg`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`  ❌ ${codepoint}: HTTP ${response.status}`);
      return false;
    }

    const svg = await response.text();
    fs.writeFileSync(dest, svg, 'utf-8');
    return true;
  } catch (error) {
    console.error(`  ❌ ${codepoint}: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🔍 Scansione kanji_master.json...\n');

  // Leggi database kanji
  const kanjiDB = JSON.parse(fs.readFileSync(KANJI_DB, 'utf-8'));

  // Crea directory se non esiste
  if (!fs.existsSync(SVG_DIR)) {
    fs.mkdirSync(SVG_DIR, { recursive: true });
  }

  // Raccogli tutti i kanji unici
  const allKanji = new Set();
  for (const level of ['N5', 'N4', 'N3', 'N2', 'N1']) {
    if (kanjiDB[level]) {
      kanjiDB[level].forEach(entry => allKanji.add(entry.kanji));
    }
  }

  console.log(`📊 Totale kanji nel database: ${allKanji.size}\n`);

  // Trova SVG mancanti
  const missing = [];
  for (const kanji of allKanji) {
    const codepoint = getCodepoint(kanji);
    const svgPath = path.join(SVG_DIR, `${codepoint}.svg`);

    if (!fs.existsSync(svgPath)) {
      missing.push({ kanji, codepoint });
    }
  }

  if (missing.length === 0) {
    console.log('✅ Tutti i file SVG sono presenti!');
    return;
  }

  console.log(`⚠️  SVG mancanti: ${missing.length}\n`);
  console.log('📥 Download in corso...\n');

  let downloaded = 0;
  let failed = 0;

  for (let i = 0; i < missing.length; i++) {
    const { kanji, codepoint } = missing[i];
    process.stdout.write(`[${i + 1}/${missing.length}] ${kanji} (${codepoint})...`);

    const success = await downloadSVG(codepoint);
    if (success) {
      console.log(' ✅');
      downloaded++;
    } else {
      failed++;
    }

    // Rate limiting
    if (i < missing.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`\n📊 Risultato:`);
  console.log(`   ✅ Scaricati: ${downloaded}`);
  if (failed > 0) {
    console.log(`   ❌ Falliti: ${failed}`);
  }
}

main().catch(console.error);
