/**
 * flashcardQueue.js - Sistema di priorità per FlashCards SRS
 *
 * Priorità:
 * 1. Frasi fallite/Near-Miss dal Dictation (critiche)
 * 2. Frasi N5 mai viste (base deck)
 * 3. Frasi completate ma non ripassate da >3 giorni (review)
 */

const MASTERY_STORAGE_KEY = 'flashcards-mastery-levels';
const N5_TOTAL_CURRICULUM = 150; // Curriculum completo (ID 1-150)
const DEFAULT_DAILY_TARGET = 15; // Default nuove carte giornaliere
const CRITICAL_THRESHOLD = 10; // Se ho meno di 10 critiche, aggiungi nuove carte
const REVIEW_INTERVAL_DAYS = 3;

/**
 * Mastery Level per ogni frase
 * @typedef {Object} MasteryData
 * @property {number} level - 0: mai vista, 1: vista una volta, 2: ripassata, 3: masterizzata
 * @property {number} lastReviewed - Timestamp ultima review
 * @property {number} reviewCount - Numero di review totali
 */

/**
 * Load mastery data from localStorage
 * @returns {Object} Map { sentenceId: MasteryData }
 */
export function loadMasteryLevels() {
  try {
    const stored = localStorage.getItem(MASTERY_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (err) {
    console.warn('[FlashcardQueue] Failed to load mastery:', err);
    return {};
  }
}

/**
 * Save mastery data to localStorage
 * @param {Object} masteryData - Map { sentenceId: MasteryData }
 */
export function saveMasteryLevels(masteryData) {
  try {
    localStorage.setItem(MASTERY_STORAGE_KEY, JSON.stringify(masteryData));
  } catch (err) {
    console.error('[FlashcardQueue] Failed to save mastery:', err);
  }
}

/**
 * Update mastery level for a sentence
 * @param {number} sentenceId
 * @param {number} newLevel - 0-3
 */
export function updateMasteryLevel(sentenceId, newLevel) {
  const mastery = loadMasteryLevels();

  mastery[sentenceId] = {
    level: newLevel,
    lastReviewed: Date.now(),
    reviewCount: (mastery[sentenceId]?.reviewCount || 0) + 1
  };

  saveMasteryLevels(mastery);
  return mastery[sentenceId];
}

/**
 * Get mastery data for a sentence
 * @param {number} sentenceId
 * @returns {MasteryData|null}
 */
export function getMasteryData(sentenceId) {
  const mastery = loadMasteryLevels();
  return mastery[sentenceId] || null;
}

/**
 * Check if sentence needs review (>3 days since last review)
 * @param {number} sentenceId
 * @returns {boolean}
 */
export function needsReview(sentenceId) {
  const mastery = getMasteryData(sentenceId);
  if (!mastery || mastery.level === 0) return false;

  const daysSinceReview = (Date.now() - mastery.lastReviewed) / (1000 * 60 * 60 * 24);
  return daysSinceReview > REVIEW_INTERVAL_DAYS;
}

/**
 * Shuffle array (Fisher-Yates algorithm)
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Build priority queue for flashcards (v2.3 - Filtri Avanzati)
 * @param {Array} allSentences - Database completo frasi
 * @param {Object} failedSentences - localStorage dictation-failed-sentences
 * @param {Array} kanjiData - Database kanji N5
 * @param {string} mode - 'mix' | 'kanji-only' | 'errors-only'
 * @returns {Object} { queue: Array, stats: Object }
 */
export function buildFlashcardQueue(allSentences, failedSentences = {}, kanjiData = [], mode = 'mix', dailyTarget = DEFAULT_DAILY_TARGET) {
  const mastery = loadMasteryLevels();

  // MODE: Kanji Only (Solo Kanji dai livelli JLPT attivi)
  if (mode === 'kanji-only') {
    const kanjiQueue = kanjiData.map((k, idx) => ({
      ...k,
      id: `kanji-${k.kanji}`,
      type: 'kanji',
      priority: 1,
      reason: 'kanji-study'
    }));

    const kanjiCompleted = kanjiData.filter(k => {
      const kanjiId = `kanji-${k.kanji}`;
      return mastery[kanjiId] && mastery[kanjiId].level >= 1;
    }).length;

    return {
      queue: kanjiQueue,
      stats: {
        total: kanjiQueue.length,
        n5KanjiTotal: kanjiData.length, // Total kanji from active JLPT levels
        n5KanjiCompleted: kanjiCompleted,
        mode: 'kanji-only'
      }
    };
  }

  // MODE: Errors Only (Solo frasi con errori dal Dictation)
  if (mode === 'errors-only') {
    const criticalIds = Object.keys(failedSentences).map(id => parseInt(id));
    const errorSentences = allSentences
      .filter(s => criticalIds.includes(s.id))
      .sort((a, b) => {
        const failA = failedSentences[a.id]?.count || 0;
        const failB = failedSentences[b.id]?.count || 0;
        return failB - failA;
      })
      .map(s => ({ ...s, type: 'sentence', priority: 1, reason: 'critical' }));

    return {
      queue: errorSentences,
      stats: {
        total: errorSentences.length,
        critical: errorSentences.length,
        mode: 'errors-only'
      }
    };
  }

  // MODE: Mix (Comportamento attuale - Default)
  // Priority 1: Critical (Sorgente 3 - Recupero Dictation)
  // Carte rosse/oro iniettate quando faccio errori nel Dictation
  const criticalIds = Object.keys(failedSentences).map(id => parseInt(id));
  const criticalSentences = allSentences
    .filter(s => criticalIds.includes(s.id))
    .sort((a, b) => {
      const failA = failedSentences[a.id]?.count || 0;
      const failB = failedSentences[b.id]?.count || 0;
      return failB - failA; // Più errori = più alta priorità
    })
    .map(s => ({ ...s, type: 'sentence', priority: 1, reason: 'critical' }));

  // Conteggio critiche
  const criticalCount = criticalSentences.length;

  // Priority 2: Nuove carte (Sorgente 1 - Curriculum + Sorgente 2 - Kanji Attivi)
  // Mix intelligente: Frasi curriculum + Kanji livelli attivi shuffle
  let newN5Cards = [];
  const shouldAddNew = criticalCount < CRITICAL_THRESHOLD;

  if (shouldAddNew) {
    // Pool curriculum: prime 150 frasi del database
    const n5Pool = allSentences.slice(0, N5_TOTAL_CURRICULUM);

    // Trova frasi curriculum mai viste (mastery level 0)
    const unseenN5Sentences = n5Pool
      .filter(s => !mastery[s.id] || mastery[s.id].level === 0)
      .filter(s => !criticalIds.includes(s.id)) // Exclude se già in critical
      .slice(0, dailyTarget)
      .map(s => ({ ...s, type: 'sentence', priority: 2, reason: 'new-sentence' }));

    // Kanji dai livelli attivi mai visti
    const unseenKanji = kanjiData
      .filter(k => {
        const kanjiId = `kanji-${k.kanji}`;
        return !mastery[kanjiId] || mastery[kanjiId].level === 0;
      })
      .slice(0, Math.floor(dailyTarget / 2)) // ~metà del target per kanji
      .map((k, idx) => ({
        ...k,
        id: `kanji-${k.kanji}`, // ID univoco per localStorage
        type: 'kanji',
        priority: 2,
        reason: 'new-kanji'
      }));

    // Mix shuffle: Alterna frasi e kanji
    const mixedN5 = shuffleArray([...unseenN5Sentences, ...unseenKanji]);
    newN5Cards = mixedN5;
  }

  // Priority 3: Review needed (>3 giorni)
  // Solo frasi N5 che sono state viste ma non ripassate di recente
  const reviewNeeded = allSentences
    .slice(0, N5_TOTAL_CURRICULUM)
    .filter(s => needsReview(s.id))
    .filter(s => !criticalIds.includes(s.id)) // Exclude critical
    .filter(s => mastery[s.id]?.level > 0 && mastery[s.id]?.level < 3) // Exclude mai viste e masterizzate
    .map(s => ({ ...s, priority: 3, reason: 'review' }));

  // Merge queue: P1 (Critical) → P2 (Nuove N5) → P3 (Review)
  const queue = [
    ...criticalSentences,
    ...newN5Cards,
    ...reviewNeeded
  ];

  // Stats per Dashboard
  const n5Pool = allSentences.slice(0, N5_TOTAL_CURRICULUM);
  const n5SentencesCompleted = n5Pool.filter(s => mastery[s.id] && mastery[s.id].level >= 1).length;
  const n5KanjiCompleted = kanjiData.filter(k => {
    const kanjiId = `kanji-${k.kanji}`;
    return mastery[kanjiId] && mastery[kanjiId].level >= 1;
  }).length;

  const stats = {
    total: queue.length,
    critical: criticalSentences.length,
    newN5: newN5Cards.length,
    newN5Sentences: newN5Cards.filter(c => c.type === 'sentence').length,
    newN5Kanji: newN5Cards.filter(c => c.type === 'kanji').length,
    reviewNeeded: reviewNeeded.length,
    n5Total: N5_TOTAL_CURRICULUM,
    n5Completed: n5SentencesCompleted,
    n5KanjiTotal: kanjiData.length,
    n5KanjiCompleted: n5KanjiCompleted,
    n5Progress: `${n5SentencesCompleted}/${N5_TOTAL_CURRICULUM}`,
    mode: 'mix'
  };

  return { queue, stats };
}

/**
 * Get mastery level label
 * @param {number} level - 0-3
 * @returns {string}
 */
export function getMasteryLabel(level) {
  const labels = {
    0: 'Mai vista',
    1: 'Vista',
    2: 'Ripassata',
    3: 'Masterizzata'
  };
  return labels[level] || 'Sconosciuto';
}

/**
 * Get mastery color (Wabi-Sabi palette)
 * @param {number} level - 0-3
 * @returns {string}
 */
export function getMasteryColor(level) {
  const colors = {
    0: '#9CA3AF', // Gray
    1: '#E9B824', // Kintsugi Gold
    2: '#6B8E23', // Matcha Green
    3: '#BC002D'  // Hinomaru Red
  };
  return colors[level] || '#9CA3AF';
}
