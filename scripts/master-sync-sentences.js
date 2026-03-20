#!/usr/bin/env node
/**
 * master-sync-sentences.js - Master Sentences Synchronization Tool
 *
 * Unifica: download-tatoeba-sentences, annotate-sentences, translate-existing-sentences, generate-audio-tts
 * Features:
 * - Scarica frasi da Tatoeba API filtrate per kanji attivi
 * - Annota automaticamente reading con marker fonetici (vowel devoicing, G nasale)
 * - Traduce automaticamente in italiano (EN→IT o JA→IT)
 * - Genera audio TTS usando SOLO reading hiragana (non kanji)
 *
 * Usage: node scripts/master-sync-sentences.js --kanji=日本 [--limit=10] [--skip-audio] [--skip-translate]
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
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

const KANJI_FILTER = args.kanji || null; // es. "日本人" per cercare frasi con questi kanji
const LIMIT = parseInt(args.limit) || 50;
const SKIP_AUDIO = args['skip-audio'] || false;
const SKIP_TRANSLATE = args['skip-translate'] || false;

const TATOEBA_API = 'https://tatoeba.org/en/api_v0/search';
const TATOEBA_AUDIO_BASE = 'https://audio.tatoeba.org/sentences/jpn';
const SENTENCES_JSON = path.join(__dirname, '../src/database/sentences.json');
const AUDIO_DIR = path.join(__dirname, '../public/audio/dictation');

/**
 * Fetch sentences from Tatoeba API
 */
async function fetchTatoebaPage(page = 1, query = '') {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      from: 'jpn',
      to: 'eng',
      has_audio: 'yes',
      sort: 'words',
      sort_reverse: 'no',
      page: page.toString()
    });

    if (query) {
      params.set('query', query);
    }

    const url = `${TATOEBA_API}?${params}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.results || []);
        } catch (e) {
          reject(new Error(`Failed to parse Tatoeba API response`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Extract reading from Tatoeba transcriptions
 */
function extractReading(sentence) {
  if (!sentence.transcriptions || sentence.transcriptions.length === 0) {
    return sentence.text;
  }

  const hrkt = sentence.transcriptions.find(t => t.script === 'Hrkt');
  if (!hrkt) return sentence.text;

  // Rimuovi tag [kanji|reading] → prendi solo reading
  let reading = hrkt.text.replace(/\[([^\]]+)\]/g, (match, content) => {
    const parts = content.split('|');
    return parts.slice(1).join('');
  });

  return reading;
}

/**
 * Extract translation from Tatoeba
 */
function extractTranslation(sentence, lang) {
  if (!sentence.translations || sentence.translations.length < 2) return '';

  const translationsList = sentence.translations[1];
  if (!Array.isArray(translationsList) || translationsList.length === 0) return '';

  const trans = translationsList.find(t => t && t.lang === lang);
  return trans ? trans.text : '';
}

/**
 * Annotate reading with phonetic markers
 * Regole:
 * - Vowel devoicing U: です → で[す], ます → ま[す]
 * - Vowel devoicing I: した → [し]た
 * - G nasale: が tra vocali → [が]
 */
function annotateReading(reading) {
  if (!reading) return null;

  let annotated = reading;

  // 1. Vowel devoicing U
  annotated = annotated.replace(/です/g, 'で[す]');
  annotated = annotated.replace(/ます/g, 'ま[す]');
  annotated = annotated.replace(/([きしちにひみり])す([。、！？!?,\.\s]|$)/g, '$1[す]$2');

  // 2. G nasale: が tra vocali
  const vowels = 'あいうえお';
  for (let v1 of vowels) {
    for (let v2 of vowels) {
      annotated = annotated.replace(new RegExp(`(${v1})が(${v2})`, 'g'), `$1[が]$2`);
      annotated = annotated.replace(new RegExp(`(${v1})ぎ(${v2})`, 'g'), `$1[ぎ]$2`);
      annotated = annotated.replace(new RegExp(`(${v1})ぐ(${v2})`, 'g'), `$1[ぐ]$2`);
      annotated = annotated.replace(new RegExp(`(${v1})げ(${v2})`, 'g'), `$1[げ]$2`);
      annotated = annotated.replace(new RegExp(`(${v1})ご(${v2})`, 'g'), `$1[ご]$2`);
    }
  }

  // 3. Vowel devoicing I
  annotated = annotated.replace(/([きしちひぴ])した/g, '$1[し]た');

  // 4. Particelle speciali
  if (!annotated.includes('[を]')) {
    annotated = annotated.replace(/([あいうえお])を([あいうえお])/g, '$1[を]$2');
  }

  return annotated === reading ? null : annotated;
}

/**
 * Translate to Italian using Google Translate (free)
 * ⚠️ IMPORTANTE: Usa libreria google-translate-api-x se disponibile
 */
async function translateToItalian(text, sourceLang = 'en') {
  if (!text || text.trim() === '') return '';

  try {
    // Usa google-translate-api-x (npm install google-translate-api-x)
    const translate = await import('@iamtraction/google-translate');
    const result = await translate.default(text, { from: sourceLang, to: 'it' });
    return result.text;
  } catch (err) {
    console.warn(`  ⚠️  Traduzione fallita: ${err.message}`);
    return '';
  }
}

/**
 * Download audio from Tatoeba
 */
async function downloadTatoebaAudio(sentenceId) {
  return new Promise((resolve) => {
    const audioPath = path.join(AUDIO_DIR, `${sentenceId}.mp3`);

    if (fs.existsSync(audioPath)) {
      resolve('skip');
      return;
    }

    const url = `${TATOEBA_AUDIO_BASE}/${sentenceId}.mp3`;

    https.get(url, (res) => {
      if (res.statusCode === 404) {
        resolve('not_found');
        return;
      }

      if (res.statusCode !== 200) {
        resolve('error');
        return;
      }

      const fileStream = fs.createWriteStream(audioPath);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve('downloaded');
      });

      fileStream.on('error', () => {
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
        resolve('error');
      });
    }).on('error', () => {
      resolve('error');
    });
  });
}

/**
 * Generate TTS using Google Translate (free, no API key)
 * ⚠️ IMPORTANTE: text deve essere SEMPRE hiragana/katakana
 */
async function generateTTS(text, outputPath) {
  return new Promise((resolve) => {
    if (fs.existsSync(outputPath)) {
      resolve(true);
      return;
    }

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
 * Load existing sentences
 */
function loadExistingSentences() {
  if (!fs.existsSync(SENTENCES_JSON)) {
    return [];
  }

  try {
    const data = fs.readFileSync(SENTENCES_JSON, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.warn('⚠️  Failed to load existing sentences:', err.message);
    return [];
  }
}

/**
 * Save sentences to JSON
 */
function saveSentences(sentences) {
  fs.writeFileSync(SENTENCES_JSON, JSON.stringify(sentences, null, 2), 'utf-8');
  console.log(`✅ Database salvato: ${SENTENCES_JSON}`);
}

/**
 * Main sync process
 */
async function main() {
  console.log(`🎌 Nihongo Sensei - Master Sentences Sync`);
  console.log(`🔍 Kanji Filter: ${KANJI_FILTER || 'Nessuno (tutte le frasi)'}`);
  console.log(`🔢 Limit: ${LIMIT}`);
  console.log(`🎤 Audio TTS: ${SKIP_AUDIO ? 'DISABILITATO' : 'ABILITATO'}`);
  console.log(`🇮🇹 Traduzione IT: ${SKIP_TRANSLATE ? 'DISABILITATA' : 'ABILITATA'}\n`);

  // Crea directory audio
  if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
  }

  // Carica frasi esistenti
  const existingSentences = loadExistingSentences();
  const existingIds = new Set(existingSentences.map(s => s.id));
  console.log(`📚 Frasi esistenti: ${existingSentences.length}\n`);

  // Fetch da Tatoeba
  console.log(`🔄 Fetching sentences from Tatoeba API...`);
  const rawSentences = await fetchTatoebaPage(1, KANJI_FILTER);
  console.log(`📋 Fetched ${rawSentences.length} sentences\n`);

  // Filtra: escludi duplicati, max 25 caratteri
  const filtered = rawSentences
    .filter(s => !existingIds.has(s.id) && s.text.length <= 25)
    .slice(0, LIMIT);

  console.log(`🔍 Filtered to ${filtered.length} NEW sentences\n`);

  const newSentences = [];
  let audioDownloaded = 0;
  let audioGenerated = 0;
  let translated = 0;

  for (let i = 0; i < filtered.length; i++) {
    const sentence = filtered[i];

    console.log(`[${i + 1}/${filtered.length}] Processing ID ${sentence.id}: "${sentence.text}"`);

    // 1. Extract data
    const reading = extractReading(sentence);
    const readingAnnotated = annotateReading(reading);
    const englishTranslation = extractTranslation(sentence, 'eng');
    let italianTranslation = extractTranslation(sentence, 'ita');

    // 2. Download audio from Tatoeba
    const audioResult = await downloadTatoebaAudio(sentence.id);
    if (audioResult === 'downloaded') {
      audioDownloaded++;
      console.log(`  🎵 Audio scaricato da Tatoeba`);
    } else if (audioResult === 'skip') {
      console.log(`  ⏭️  Audio già presente`);
    } else {
      console.log(`  ⚠️  Audio non disponibile su Tatoeba`);
    }

    // 3. Translate to Italian
    if (!SKIP_TRANSLATE && !italianTranslation && englishTranslation) {
      console.log(`  🇮🇹 Traducendo: "${englishTranslation}"`);
      italianTranslation = await translateToItalian(englishTranslation, 'en');
      if (italianTranslation) {
        translated++;
        console.log(`  ✅ → "${italianTranslation}"`);
      }
      await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
    }

    // 4. Generate TTS (usa reading hiragana)
    if (!SKIP_AUDIO) {
      const ttsPath = path.join(AUDIO_DIR, `${sentence.id}.mp3`);
      if (!fs.existsSync(ttsPath)) {
        console.log(`  🎤 Generando TTS (text: "${reading}")...`);
        const success = await generateTTS(reading, ttsPath);
        if (success) {
          audioGenerated++;
          console.log(`  ✅ TTS generato`);
        } else {
          console.log(`  ❌ TTS fallito`);
        }
      }
    }

    // 5. Build entry
    const newEntry = {
      id: sentence.id,
      japanese: sentence.text,
      reading,
      english: englishTranslation,
      italian: italianTranslation
    };

    if (readingAnnotated) {
      newEntry.reading_annotated = readingAnnotated;
    }

    newSentences.push(newEntry);

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Merge con esistenti
  const allSentences = [...existingSentences, ...newSentences];
  saveSentences(allSentences);

  // Report finale
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📈 REPORT SINCRONIZZAZIONE SENTENCES`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  ✅ Frasi totali: ${allSentences.length} (${existingSentences.length} precedenti + ${newSentences.length} nuove)`);
  console.log(`  🎵 Audio Tatoeba scaricati: ${audioDownloaded}`);
  if (!SKIP_AUDIO) {
    console.log(`  🎤 Audio TTS generati: ${audioGenerated}`);
  }
  if (!SKIP_TRANSLATE) {
    console.log(`  🇮🇹 Traduzioni IT: ${translated}`);
  }

  console.log(`\n✨ Sincronizzazione completata!`);
  console.log(`📂 Database aggiornato: ${SENTENCES_JSON}`);
  console.log(`🎯 Frasi pronte per Dictation Master e Flashcards!\n`);
}

main().catch(console.error);
