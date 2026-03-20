#!/usr/bin/env node
/**
 * maintenance-tool.js - Strumento di Manutenzione Database
 *
 * Funzioni:
 * - audit: Report completo su SVG/Audio mancanti
 * - repair-audio: Rigenera audio per un kanji/frase specifico con pronuncia corretta
 *
 * Usage:
 *   node scripts/maintenance-tool.js audit
 *   node scripts/maintenance-tool.js repair-audio --kanji=正しく --reading=ただしく
 *   node scripts/maintenance-tool.js repair-audio --sentence=9999
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CLI arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split('=');
  acc[key.replace('--', '')] = value || true;
  return acc;
}, {});

const COMMAND = args._?.[0] || process.argv[2];
const KANJI_MASTER_JSON = path.join(__dirname, '../src/database/kanji_master.json');
const SENTENCES_JSON = path.join(__dirname, '../src/database/sentences.json');
const SVG_DIR = path.join(__dirname, '../public/kanji');
const KANJI_AUDIO_DIR = path.join(__dirname, '../public/audio/kanji');
const SENTENCES_AUDIO_DIR = path.join(__dirname, '../public/audio/dictation');

/**
 * Convert kanji to hex (KanjiVG format)
 */
function kanjiToHex(kanji) {
  return kanji.codePointAt(0).toString(16).padStart(5, '0');
}

/**
 * Generate TTS using Google Translate
 */
async function generateTTS(text, outputPath) {
  return new Promise((resolve) => {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=ja&client=tw-ob`;

    const curl = spawn('curl', [
      '-A', 'Mozilla/5.0',
      '-o', outputPath,
      '-s',
      url
    ]);

    curl.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        resolve(true);
      } else {
        resolve(false);
      }
    });

    curl.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * AUDIT: Verifica SVG e Audio mancanti
 */
async function auditDatabase() {
  console.log(`🔍 Nihongo Sensei - Database Audit\n`);
  console.log(`${'='.repeat(60)}\n`);

  // Load databases
  const kanjiMaster = JSON.parse(fs.readFileSync(KANJI_MASTER_JSON, 'utf-8'));
  const sentences = fs.existsSync(SENTENCES_JSON)
    ? JSON.parse(fs.readFileSync(SENTENCES_JSON, 'utf-8'))
    : [];

  let totalKanji = 0;
  let totalSVGMissing = 0;
  let totalKanjiAudioMissing = 0;

  // Audit kanji per livello
  console.log(`📊 KANJI AUDIT\n`);

  for (const [level, kanjiList] of Object.entries(kanjiMaster)) {
    if (!kanjiList || kanjiList.length === 0) continue;

    totalKanji += kanjiList.length;

    const missingSVGs = [];
    const missingAudio = [];

    for (const kanjiObj of kanjiList) {
      const hex = kanjiToHex(kanjiObj.kanji);
      const svgPath = path.join(SVG_DIR, `${hex}.svg`);
      const audioPath = path.join(KANJI_AUDIO_DIR, `${hex}.mp3`);

      if (!fs.existsSync(svgPath)) {
        missingSVGs.push({ kanji: kanjiObj.kanji, hex });
        totalSVGMissing++;
      }

      if (!fs.existsSync(audioPath)) {
        missingAudio.push({ kanji: kanjiObj.kanji, hex, reading: kanjiObj.audio_text });
        totalKanjiAudioMissing++;
      }
    }

    console.log(`${level}:`);
    console.log(`  Total: ${kanjiList.length}`);
    console.log(`  SVG presenti: ${kanjiList.length - missingSVGs.length} / ${kanjiList.length}`);
    console.log(`  Audio presenti: ${kanjiList.length - missingAudio.length} / ${kanjiList.length}`);

    if (missingSVGs.length > 0) {
      console.log(`  ⚠️  SVG mancanti (${missingSVGs.length}):`);
      missingSVGs.slice(0, 5).forEach(m => {
        console.log(`    - ${m.kanji} (${m.hex}.svg)`);
      });
      if (missingSVGs.length > 5) {
        console.log(`    ... e altri ${missingSVGs.length - 5}`);
      }
    }

    if (missingAudio.length > 0) {
      console.log(`  ⚠️  Audio mancanti (${missingAudio.length}):`);
      missingAudio.slice(0, 5).forEach(m => {
        console.log(`    - ${m.kanji} (${m.hex}.mp3) - reading: "${m.reading}"`);
      });
      if (missingAudio.length > 5) {
        console.log(`    ... e altri ${missingAudio.length - 5}`);
      }
    }

    console.log();
  }

  // Audit sentences
  console.log(`📊 SENTENCES AUDIT\n`);
  console.log(`  Total: ${sentences.length}`);

  const sentencesAudioMissing = sentences.filter(s => {
    const audioPath = path.join(SENTENCES_AUDIO_DIR, `${s.id}.mp3`);
    return !fs.existsSync(audioPath);
  });

  console.log(`  Audio presenti: ${sentences.length - sentencesAudioMissing.length} / ${sentences.length}`);

  if (sentencesAudioMissing.length > 0) {
    console.log(`  ⚠️  Audio mancanti (${sentencesAudioMissing.length}):`);
    sentencesAudioMissing.slice(0, 5).forEach(s => {
      console.log(`    - ID ${s.id}: "${s.japanese}" (reading: "${s.reading}")`);
    });
    if (sentencesAudioMissing.length > 5) {
      console.log(`    ... e altri ${sentencesAudioMissing.length - 5}`);
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📈 SUMMARY\n`);
  console.log(`  📚 Kanji totali: ${totalKanji}`);
  console.log(`  🖼️  SVG mancanti: ${totalSVGMissing} (${Math.round(totalSVGMissing / totalKanji * 100)}%)`);
  console.log(`  🎤 Audio kanji mancanti: ${totalKanjiAudioMissing} (${Math.round(totalKanjiAudioMissing / totalKanji * 100)}%)`);
  console.log(`  📝 Frasi totali: ${sentences.length}`);
  console.log(`  🎤 Audio frasi mancanti: ${sentencesAudioMissing.length} (${Math.round(sentencesAudioMissing.length / sentences.length * 100)}%)`);

  if (totalSVGMissing > 0) {
    console.log(`\n💡 Per scaricare SVG mancanti:`);
    console.log(`   node scripts/master-sync-kanji.js --level=N5 --skip-audio`);
  }

  if (totalKanjiAudioMissing > 0) {
    console.log(`\n💡 Per generare audio kanji mancanti:`);
    console.log(`   node scripts/master-sync-kanji.js --level=N5 --skip-svg`);
  }

  if (sentencesAudioMissing.length > 0) {
    console.log(`\n💡 Per generare audio frasi mancanti:`);
    console.log(`   node scripts/master-sync-sentences.js --limit=${sentencesAudioMissing.length} --skip-translate`);
  }

  console.log();
}

/**
 * REPAIR-AUDIO: Rigenera audio per un kanji/frase specifico
 */
async function repairAudio() {
  const kanji = args.kanji;
  const reading = args.reading;
  const sentenceId = args.sentence ? parseInt(args.sentence) : null;
  const allSentences = args['all-sentences'];

  if (!kanji && !sentenceId && !allSentences) {
    console.error(`❌ Specifica --kanji=X --reading=Y oppure --sentence=ID oppure --all-sentences`);
    console.log(`\nEsempi:`);
    console.log(`  node scripts/maintenance-tool.js repair-audio --kanji=正しく --reading=ただしく`);
    console.log(`  node scripts/maintenance-tool.js repair-audio --sentence=9999`);
    console.log(`  node scripts/maintenance-tool.js repair-audio --all-sentences`);
    process.exit(1);
  }

  console.log(`🔧 Nihongo Sensei - Audio Repair\n`);

  // Repair kanji audio
  if (kanji) {
    if (!reading) {
      console.error(`❌ Specifica --reading per il kanji "${kanji}"`);
      process.exit(1);
    }

    console.log(`🎤 Rigenerando audio per kanji: ${kanji}`);
    console.log(`   Reading: ${reading}\n`);

    const hex = kanjiToHex(kanji);
    const audioPath = path.join(KANJI_AUDIO_DIR, `${hex}.mp3`);

    // Rimuovi file esistente
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
      console.log(`🗑️  Rimosso audio esistente: ${hex}.mp3`);
    }

    // Genera nuovo audio
    console.log(`🎤 Generando TTS con reading: "${reading}"...`);
    const success = await generateTTS(reading, audioPath);

    if (success) {
      console.log(`✅ Audio generato: ${audioPath}`);
      console.log(`   Dimensione: ${(fs.statSync(audioPath).size / 1024).toFixed(2)} KB\n`);
    } else {
      console.error(`❌ Errore generazione TTS\n`);
      process.exit(1);
    }
  }

  // Repair sentence audio
  if (sentenceId) {
    const sentences = JSON.parse(fs.readFileSync(SENTENCES_JSON, 'utf-8'));
    const sentence = sentences.find(s => s.id === sentenceId);

    if (!sentence) {
      console.error(`❌ Frase ID ${sentenceId} non trovata nel database`);
      process.exit(1);
    }

    console.log(`🎤 Rigenerando audio per frase ID ${sentenceId}:`);
    console.log(`   Japanese: ${sentence.japanese}`);
    console.log(`   Reading: ${sentence.reading}\n`);

    const audioPath = path.join(SENTENCES_AUDIO_DIR, `${sentenceId}.mp3`);

    // Rimuovi file esistente
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
      console.log(`🗑️  Rimosso audio esistente: ${sentenceId}.mp3`);
    }

    // Genera nuovo audio
    console.log(`🎤 Generando TTS con reading: "${sentence.reading}"...`);
    const success = await generateTTS(sentence.reading, audioPath);

    if (success) {
      console.log(`✅ Audio generato: ${audioPath}`);
      console.log(`   Dimensione: ${(fs.statSync(audioPath).size / 1024).toFixed(2)} KB\n`);
    } else {
      console.error(`❌ Errore generazione TTS\n`);
      process.exit(1);
    }
  }

  // Repair all sentences audio
  if (allSentences) {
    const sentences = JSON.parse(fs.readFileSync(SENTENCES_JSON, 'utf-8'));

    console.log(`🎤 Rigenerando audio per TUTTE le frasi (${sentences.length} totali)\n`);
    console.log(`⚠️  ATTENZIONE: Questa operazione sovrascriverà tutti gli audio esistenti!\n`);

    let success = 0;
    let failed = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const audioPath = path.join(SENTENCES_AUDIO_DIR, `${sentence.id}.mp3`);

      console.log(`[${i + 1}/${sentences.length}] ID ${sentence.id}: "${sentence.japanese}"`);
      console.log(`  Reading: ${sentence.reading}`);

      // Rimuovi file esistente
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }

      // Genera nuovo audio usando READING (hiragana)
      const result = await generateTTS(sentence.reading, audioPath);

      if (result) {
        const size = (fs.statSync(audioPath).size / 1024).toFixed(2);
        console.log(`  ✅ Generato (${size} KB)\n`);
        success++;
      } else {
        console.log(`  ❌ Fallito\n`);
        failed++;
      }

      // Delay per evitare rate limiting
      if (i < sentences.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 RISULTATI:\n`);
    console.log(`  ✅ Successi: ${success}/${sentences.length}`);
    console.log(`  ❌ Falliti: ${failed}/${sentences.length}`);
    console.log(`  📁 Directory: ${SENTENCES_AUDIO_DIR}\n`);
  }

  console.log(`✨ Repair completato!\n`);
}

/**
 * Main
 */
async function main() {
  if (!COMMAND) {
    console.log(`🛠️  Nihongo Sensei - Maintenance Tool\n`);
    console.log(`Usage:`);
    console.log(`  node scripts/maintenance-tool.js audit`);
    console.log(`  node scripts/maintenance-tool.js repair-audio --kanji=正しく --reading=ただしく`);
    console.log(`  node scripts/maintenance-tool.js repair-audio --sentence=9999`);
    console.log(`  node scripts/maintenance-tool.js repair-audio --all-sentences\n`);
    process.exit(0);
  }

  switch (COMMAND) {
    case 'audit':
      await auditDatabase();
      break;

    case 'repair-audio':
      await repairAudio();
      break;

    default:
      console.error(`❌ Comando non valido: ${COMMAND}`);
      console.log(`Comandi disponibili: audit, repair-audio\n`);
      process.exit(1);
  }
}

main().catch(console.error);
