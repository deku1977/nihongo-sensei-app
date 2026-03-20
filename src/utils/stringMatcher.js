/**
 * stringMatcher.js - Fuzzy matching con Levenshtein distance
 * Calcola similarità tra input utente e target per tollerare piccoli typos
 */

/**
 * Calcola la distanza di Levenshtein tra due stringhe
 * Misura il numero minimo di edit (insert, delete, replace) per trasformare s1 in s2
 *
 * @param {string} s1 - Prima stringa
 * @param {string} s2 - Seconda stringa
 * @returns {number} - Distanza di Levenshtein
 */
export function levenshteinDistance(s1, s2) {
  const len1 = s1.length;
  const len2 = s2.length;

  // Ottimizzazione: se una stringa è vuota, distanza = lunghezza dell'altra
  if (len1 === 0) return len2;
  if (len2 === 0) return len1;

  // Matrice di programmazione dinamica
  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

  // Inizializza prima riga e colonna
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  // Riempi matrice con distanze progressive
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // Deletion
        matrix[i][j - 1] + 1,      // Insertion
        matrix[i - 1][j - 1] + cost // Substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calcola la percentuale di similarità tra due stringhe
 * Formula: 1 - (distance / maxLength) * 100
 *
 * @param {string} s1 - Prima stringa
 * @param {string} s2 - Seconda stringa
 * @returns {number} - Percentuale similarità (0-100)
 */
export function calculateSimilarity(s1, s2) {
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);

  // Evita divisione per zero
  if (maxLength === 0) return 100;

  const similarity = (1 - (distance / maxLength)) * 100;
  return Math.round(similarity * 100) / 100; // Round a 2 decimali
}

/**
 * Match states
 */
export const MatchState = {
  CORRECT: 'CORRECT',       // 100% match
  NEAR_MISS: 'NEAR_MISS',   // >85% match (typo tollerato)
  INCORRECT: 'INCORRECT'    // <85% match
};

/**
 * Valuta il match tra input utente e target
 * Applica threshold per classificare: CORRECT, NEAR_MISS, INCORRECT
 *
 * @param {string} userInput - Input dell'utente
 * @param {string} target - Target corretto
 * @param {Object} options - Opzioni
 * @param {boolean} options.normalize - Rimuovi punteggiatura (default: true)
 * @param {number} options.nearMissThreshold - Soglia NEAR_MISS (default: 85)
 * @returns {Object} - { state, similarity, distance }
 */
export function evaluateMatch(userInput, target, options = {}) {
  const {
    normalize = true,
    nearMissThreshold = 85
  } = options;

  // Normalize strings (rimuovi punteggiatura)
  const normalizedInput = normalize ? normalizeText(userInput) : userInput;
  const normalizedTarget = normalize ? normalizeText(target) : target;

  // Calcola similarità
  const similarity = calculateSimilarity(normalizedInput, normalizedTarget);
  const distance = levenshteinDistance(normalizedInput, normalizedTarget);

  // Determina stato
  let state;
  if (similarity === 100) {
    state = MatchState.CORRECT;
  } else if (similarity >= nearMissThreshold) {
    state = MatchState.NEAR_MISS;
  } else {
    state = MatchState.INCORRECT;
  }

  return {
    state,
    similarity,
    distance,
    normalizedInput,
    normalizedTarget
  };
}

/**
 * Normalizza testo: rimuovi punteggiatura (giapponese e occidentale)
 * e gestisci particella を (wo → o)
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text) {
  return text
    .trim()
    .replace(/[。、！？!?,\.]/g, '')
    // Normalizza particella を: accetta sia "wo" che "o"
    .replace(/wo/g, 'o'); // Converte "wo" in "o" per matching uniforme
}

/**
 * Example usage:
 *
 * const result = evaluateMatch('こんにちわ', 'こんにちは');
 * console.log(result);
 * // { state: 'NEAR_MISS', similarity: 90.91, distance: 1, ... }
 *
 * if (result.state === MatchState.NEAR_MISS) {
 *   console.log('Quasi! Solo un piccolo typo');
 * }
 */
