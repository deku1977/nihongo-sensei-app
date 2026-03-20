/**
 * Kana Utilities - Normalizzazione Hiragana/Katakana
 * Converte tutte le stringhe in un formato comune per confronti agnostici
 */

/**
 * Converte Katakana in Hiragana
 * @param {string} str - Stringa da convertire
 * @returns {string} - Stringa con katakana convertito in hiragana
 */
export function toHiragana(str) {
  if (!str) return '';

  return str.replace(/[\u30A0-\u30FF]/g, (match) => {
    const code = match.charCodeAt(0);
    // Katakana range: 0x30A0-0x30FF
    // Hiragana range: 0x3040-0x309F
    // Offset: -0x60 (96 in decimal)

    // Special cases (non-convertible symbols)
    if (code === 0x30FB) return match; // ・ (middle dot)
    if (code === 0x30FC) return match; // ー (long vowel mark)

    // Convert standard katakana to hiragana
    if (code >= 0x30A1 && code <= 0x30F6) {
      return String.fromCharCode(code - 0x60);
    }

    return match;
  });
}

/**
 * Converte Hiragana in Katakana
 * @param {string} str - Stringa da convertire
 * @returns {string} - Stringa con hiragana convertito in katakana
 */
export function toKatakana(str) {
  if (!str) return '';

  return str.replace(/[\u3040-\u309F]/g, (match) => {
    const code = match.charCodeAt(0);

    // Convert standard hiragana to katakana
    if (code >= 0x3041 && code <= 0x3096) {
      return String.fromCharCode(code + 0x60);
    }

    return match;
  });
}

/**
 * Normalizza una stringa per confronti kana-agnostic
 * Converte tutto in hiragana e rimuove spazi/punteggiatura
 * @param {string} str - Stringa da normalizzare
 * @returns {string} - Stringa normalizzata
 */
export function normalizeKana(str) {
  if (!str) return '';

  return toHiragana(str.trim().toLowerCase());
}

/**
 * Confronta due stringhe in modo kana-agnostic
 * @param {string} str1 - Prima stringa
 * @param {string} str2 - Seconda stringa
 * @returns {boolean} - True se equivalenti
 */
export function kanaEquals(str1, str2) {
  return normalizeKana(str1) === normalizeKana(str2);
}
