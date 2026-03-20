#!/usr/bin/env node
/**
 * master-sync-kanji.js - Master Kanji Synchronization Tool
 *
 * Unifica: sync-kanji, download-kanjivg, check-missing-svg
 * Features:
 * - Download metadati da kanjiapi.dev
 * - Verifica e scarica SVG da KanjiVG
 * - Genera audio TTS usando SOLO letture hiragana (onyomi/kunyomi)
 * - Report completo con statistiche
 *
 * Usage: node scripts/master-sync-kanji.js --level=N5 [--limit=10] [--skip-audio] [--skip-svg]
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

const LEVEL = args.level || 'N5';
const LIMIT = parseInt(args.limit) || null;
const SKIP_AUDIO = args['skip-audio'] || false;
const SKIP_SVG = args['skip-svg'] || false;

// JLPT Kanji Lists (Complete)
const JLPT_KANJI = {
  N5: [
    // Numeri (14)
    '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '百', '千', '万', '円',
    // Tempo (13)
    '日', '月', '火', '水', '木', '金', '土', '年', '時', '分', '半', '今', '何',
    // Persone & Società (13)
    '人', '名', '男', '女', '子', '学', '生', '先', '友', '父', '母', '私', '々',
    // Luoghi (14)
    '国', '外', '中', '東', '西', '南', '北', '上', '下', '左', '右', '前', '後',
    // Azioni (14)
    '行', '来', '帰', '入', '出', '見', '聞', '食', '飲', '読', '書', '話', '言', '買',
    // Oggetti & Concetti (12)
    '本', '気', '天', '山', '川', '田', '土', '雨', '電', '車', '語', '文', '校',
    // Dimensioni & Quantità (9)
    '大', '小', '高', '安', '新', '古', '長', '多', '少',
    // Altri comuni (6)
    '間', '毎', '白', '立', '休', '早', '明'
  ],
  N4: [
    // Numeri & Quantità avanzati
    '以', '内', '他', '全', '両', '度', '番', '様', '代', '第',
    // Tempo & Calendario
    '午', '朝', '昼', '夜', '週', '春', '夏', '秋', '冬', '去', '当', '初', '終', '始',
    // Persone & Relazioni
    '主', '兄', '弟', '姉', '妹', '夫', '妻', '方', '君', '心', '体', '頭', '顔', '目', '耳', '口', '手', '足',
    // Azioni & Verbi
    '会', '使', '作', '住', '働', '勉', '強', '教', '思', '答', '知', '貸', '借', '送', '開', '閉', '待', '持', '死', '走', '起', '着', '売', '洗', '遊', '運', '動', '勝', '負', '切', '押', '引', '写',
    // Luoghi & Direzioni
    '店', '室', '病', '院', '駅', '市', '町', '村', '近', '遠', '太', '細', '重', '軽', '速', '遅',
    // Oggetti
    '物', '品', '品', '服', '色', '紙', '風', '花', '肉', '魚', '料', '理', '味', '茶', '飯', '犬', '猫',
    // Caratteristiche
    '便', '利', '不', '悪', '同', '正', '反', '若', '元', '丸', '太', '赤', '青', '黒', '的',
    // Concetti & Idee
    '事', '自', '分', '意', '考', '注', '意', '用', '特', '別', '質', '問', '題', '計', '画', '建', '者', '業', '仕', '研', '究', '映', '画', '歌', '引',
    // Comunicazione
    '声', '英', '漢', '字', '記', '説', '注',
    // Stati & Condizioni
    '暑', '寒', '熱', '冷', '空', '消', '有', '無', '真', '実', '安', '全', '危', '険',
    // Trasporti & Viaggio
    '道', '通', '乗', '発', '着', '世', '界', '旅', '場', '所',
    // Natura
    '海', '野', '林', '森', '石', '台', '地', '夕', '光', '音',
    // Società & Istituzioni
    '社', '公', '私', '民', '法', '政', '経', '済',
    // Varie
    '力', '工', '業', '産', '業', '歴', '史', '科', '々', '昔', '相', '向', '医', '薬', '曜', '変', '広', '和'
  ],
  N3: ['政', '議', '民', '連', '対', '部', '合', '市', '内', '相'],
  N2: ['済', '破', '述', '革', '就', '航', '郎', '徴', '販', '幅'],
  N1: ['璧', '瞭', '憾', '遜', '摯', '謙', '慎', '慮', '綿', '蜜']
};

/**
 * Fetch kanji data from kanjiapi.dev
 */
async function fetchKanjiData(character) {
  return new Promise((resolve, reject) => {
    const url = `https://kanjiapi.dev/v1/kanji/${encodeURIComponent(character)}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON for ${character}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Transform API data to internal format with audio_text field
 */
function transformKanjiData(apiData, kanji) {
  const onyomi = apiData.on_readings?.join('、') || '';
  const kunyomi = apiData.kun_readings?.join('、') || '';

  // ⚠️ FIX CRITICO: audio_text contiene SOLO hiragana (onyomi/kunyomi)
  const audioText = [onyomi, kunyomi].filter(r => r).join('、');

  return {
    kanji,
    onyomi,
    kunyomi,
    meaning: apiData.meanings?.join(', ') || '',
    strokes: apiData.stroke_count || 0,
    audio_text: audioText, // Campo tracciato per TTS
    examples: (apiData.words || []).slice(0, 2).map(w => ({
      word: w.kanji || kanji,
      reading: w.reading || '',
      meaning: w.meanings?.[0] || '',
      audio_text: w.reading || '' // ⚠️ SEMPRE hiragana per gli esempi
    }))
  };
}

/**
 * Load or create kanji_master.json
 */
function loadMasterDatabase() {
  const dbPath = path.join(__dirname, '../src/database/kanji_master.json');

  if (fs.existsSync(dbPath)) {
    return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  }

  return { N5: [], N4: [], N3: [], N2: [], N1: [] };
}

/**
 * Save kanji_master.json
 */
function saveMasterDatabase(data) {
  const dbPath = path.join(__dirname, '../src/database/kanji_master.json');
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✅ Database salvato: ${dbPath}`);
}

/**
 * Convert kanji to hex (KanjiVG format)
 */
function kanjiToHex(kanji) {
  return kanji.codePointAt(0).toString(16).padStart(5, '0');
}

/**
 * Check missing SVG files
 */
function checkMissingSVGs(kanjiList) {
  const svgDir = path.join(__dirname, '../public/kanji');

  if (!fs.existsSync(svgDir)) {
    fs.mkdirSync(svgDir, { recursive: true });
    return kanjiList; // All missing if dir doesn't exist
  }

  return kanjiList.filter(kanji => {
    const hex = kanjiToHex(kanji);
    const svgPath = path.join(svgDir, `${hex}.svg`);
    return !fs.existsSync(svgPath);
  });
}

/**
 * Download single SVG from KanjiVG
 */
async function downloadSVG(kanji, outputDir) {
  const hex = kanjiToHex(kanji);
  const url = `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${hex}.svg`;
  const outputPath = path.join(outputDir, `${hex}.svg`);

  if (fs.existsSync(outputPath)) {
    return 'skip';
  }

  return new Promise((resolve) => {
    https.get(url, (res) => {
      if (res.statusCode === 404) {
        resolve('not_found');
        return;
      }

      if (res.statusCode !== 200) {
        resolve('error');
        return;
      }

      const fileStream = fs.createWriteStream(outputPath);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve('downloaded');
      });

      fileStream.on('error', () => {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
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
 * Generate all audio for a kanji (kanji + examples)
 */
async function generateKanjiAudio(kanjiData, hex) {
  const audioDir = path.join(__dirname, '../public/audio/kanji');

  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }

  const results = {
    kanji: false,
    examples: []
  };

  // ⚠️ USA audio_text invece di costruire manualmente
  if (kanjiData.audio_text) {
    const kanjiPath = path.join(audioDir, `${hex}.mp3`);
    results.kanji = await generateTTS(kanjiData.audio_text, kanjiPath);
  }

  // Audio per ogni esempio
  if (kanjiData.examples && kanjiData.examples.length > 0) {
    for (let i = 0; i < kanjiData.examples.length; i++) {
      const example = kanjiData.examples[i];
      const examplePath = path.join(audioDir, `${hex}_example_${i}.mp3`);
      // ⚠️ USA example.audio_text (che è sempre hiragana)
      const success = await generateTTS(example.audio_text, examplePath);
      results.examples.push(success);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return results;
}

/**
 * Main sync process
 */
async function main() {
  console.log(`🎌 Nihongo Sensei - Master Kanji Sync`);
  console.log(`📊 Livello: ${LEVEL}`);
  console.log(`🔢 Limit: ${LIMIT || 'Tutti'}`);
  console.log(`🎤 Audio TTS: ${SKIP_AUDIO ? 'DISABILITATO' : 'ABILITATO'}`);
  console.log(`🖼️  SVG Download: ${SKIP_SVG ? 'DISABILITATO' : 'ABILITATO'}\n`);

  const kanjiList = JLPT_KANJI[LEVEL];

  if (!kanjiList) {
    console.error(`❌ Livello non valido: ${LEVEL}`);
    console.log(`Livelli disponibili: N5, N4, N3, N2, N1`);
    process.exit(1);
  }

  const targetList = LIMIT ? kanjiList.slice(0, LIMIT) : kanjiList;
  const masterDB = loadMasterDatabase();
  const results = [];

  let audioSuccessCount = 0;
  let audioFailCount = 0;
  let svgDownloaded = 0;
  let svgNotFound = 0;
  let svgErrors = 0;

  console.log(`🔄 Sincronizzazione di ${targetList.length} kanji...\n`);

  for (let i = 0; i < targetList.length; i++) {
    const kanji = targetList[i];
    const hex = kanjiToHex(kanji);

    try {
      console.log(`[${i + 1}/${targetList.length}] Processing ${kanji} (${hex})...`);

      // 1. Fetch metadata
      const apiData = await fetchKanjiData(kanji);
      const transformed = transformKanjiData(apiData, kanji);
      results.push(transformed);

      // 2. Download SVG if needed
      if (!SKIP_SVG) {
        const svgDir = path.join(__dirname, '../public/kanji');
        if (!fs.existsSync(svgDir)) fs.mkdirSync(svgDir, { recursive: true });

        const svgResult = await downloadSVG(kanji, svgDir);
        if (svgResult === 'downloaded') {
          svgDownloaded++;
          console.log(`  🎨 SVG: Scaricato`);
        } else if (svgResult === 'skip') {
          console.log(`  🎨 SVG: Già presente`);
        } else if (svgResult === 'not_found') {
          svgNotFound++;
          console.log(`  ⚠️  SVG: Non trovato su KanjiVG`);
        } else if (svgResult === 'error') {
          svgErrors++;
          console.log(`  ❌ SVG: Errore download`);
        }
      }

      // 3. Generate audio TTS
      if (!SKIP_AUDIO) {
        console.log(`  🎤 Generando audio TTS (text: "${transformed.audio_text}")...`);
        const audioResults = await generateKanjiAudio(transformed, hex);

        if (audioResults.kanji) audioSuccessCount++;
        else audioFailCount++;

        audioSuccessCount += audioResults.examples.filter(r => r).length;
        audioFailCount += audioResults.examples.filter(r => !r).length;

        console.log(`  ✅ Audio: ${audioResults.kanji ? '✓' : '✗'} kanji, ${audioResults.examples.filter(r => r).length}/${audioResults.examples.length} esempi`);
      }

      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (error) {
      console.error(`  ⚠️  Errore: ${error.message}`);

      const existing = masterDB[LEVEL]?.find(k => k.kanji === kanji);
      if (existing) {
        results.push(existing);
      } else {
        results.push({
          kanji,
          onyomi: '',
          kunyomi: '',
          meaning: 'N/A',
          strokes: 0,
          audio_text: '',
          examples: []
        });
      }
    }
  }

  // Update master database
  masterDB[LEVEL] = results;
  saveMasterDatabase(masterDB);

  // Final report
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📈 REPORT SINCRONIZZAZIONE ${LEVEL}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  ✅ Kanji sincronizzati: ${results.length}`);

  if (!SKIP_SVG) {
    console.log(`  🖼️  SVG scaricati: ${svgDownloaded}`);
    console.log(`  🖼️  SVG non trovati: ${svgNotFound}`);
    console.log(`  🖼️  SVG errori: ${svgErrors}`);
  }

  if (!SKIP_AUDIO) {
    const totalAudio = audioSuccessCount + audioFailCount;
    const percentage = totalAudio > 0 ? Math.round(audioSuccessCount / totalAudio * 100) : 0;
    console.log(`  🎤 Audio generati: ${audioSuccessCount} / ${totalAudio} (${percentage}%)`);
  }

  console.log(`\n✨ Sincronizzazione completata!`);
  console.log(`📂 Database aggiornato: src/database/kanji_master.json`);
  console.log(`🎯 Puoi ora usare i kanji ${LEVEL} nell'app!\n`);
}

main().catch(console.error);
