/**
 * phoneticParser.js - Sistema di Annotazione Intelligente per Phonetic Hints
 *
 * FORMATO JSON:
 * {
 *   "reading": "desu",
 *   "reading_annotated": "de[su]"  // 'su' = U compressa (vowel devoicing)
 * }
 * {
 *   "reading": "otagaini",
 *   "reading_annotated": "ota[ga]ini"  // 'ga' = G nasale (suona come 'ra/na')
 * }
 *
 * RENDERING:
 * - Caratteri tra [...] → opacity: 0.4, font-style: italic
 * - Hover → opacity: 0.7, scale(1.1), mostra tooltip con hint
 *
 * VALIDAZIONE:
 * - stringMatcher.js pulisce [...] prima del confronto input utente
 * - Utente NON deve digitare le parentesi
 */

/**
 * Parse text con marker fonetici [...] e ritorna array di token
 * @param {string} text - Testo con marker (es. "これはほんで[す]")
 * @returns {Array<Object>} - Array di token: { text, isAnnotated, hint }
 *
 * @example
 * parsePhoneticAnnotations("de[su]")
 * // [
 * //   { text: "de", isAnnotated: false, hint: null },
 * //   { text: "su", isAnnotated: true, hint: "La U è molto breve..." }
 * // ]
 */
export function parsePhoneticAnnotations(text) {
  if (!text) return [];

  const tokens = [];
  const regex = /\[([^\]]+)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Testo normale prima del marker
    if (match.index > lastIndex) {
      const normalText = text.substring(lastIndex, match.index);
      tokens.push({
        text: normalText,
        isAnnotated: false,
        hint: null
      });
    }

    // Carattere annotato
    const annotatedChar = match[1];
    tokens.push({
      text: annotatedChar,
      isAnnotated: true,
      hint: getPhoneticHint(annotatedChar) // Hint context-aware
    });

    lastIndex = regex.lastIndex;
  }

  // Testo restante dopo ultimo marker
  if (lastIndex < text.length) {
    const normalText = text.substring(lastIndex);
    tokens.push({
      text: normalText,
      isAnnotated: false,
      hint: null
    });
  }

  return tokens;
}

/**
 * Remove phonetic markers from text (per confronto input)
 * @param {string} text - Testo annotato
 * @returns {string} - Testo pulito (es. "で[す]" → "です")
 */
export function stripPhoneticMarkers(text) {
  if (!text) return '';
  return text.replace(/\[([^\]]+)\]/g, '$1');
}

/**
 * Get phonetic hint for specific character/pattern
 * Context-aware hints per compressione vocalica, G nasale, e suoni speciali
 *
 * @param {string} char - Carattere/pattern annotato
 * @returns {string} - Hint testuale
 */
function getPhoneticHint(char) {
  const hints = {
    // Compressione vocalica U (vowel devoicing)
    'す': '🔇 La U è molto breve, quasi silenziosa (vowel devoicing)',
    'です': '🔇 La U finale è quasi muta in contesto formale',
    'ます': '🔇 La U finale è quasi muta (desu/masu form)',
    'く': '🔇 La U può essere compressa tra consonanti sorde',
    'つ': '🔇 La U può essere compressa (tsu → ts)',

    // G nasale (びだくおん - bidakuon)
    'が': '👂 G nasale: suona come "nga" o "ra" (tra vocali)',
    'ぎ': '👂 G nasale: suona come "ngi" o "ri" (tra vocali)',
    'ぐ': '👂 G nasale: suona come "ngu" o "ru" (tra vocali)',
    'げ': '👂 G nasale: suona come "nge" o "re" (tra vocali)',
    'ご': '👂 G nasale: suona come "ngo" o "ro" (tra vocali)',

    // Particelle con pronuncia speciale
    'を': '📌 Particella oggetto: pronunciato "o" (non "wo")',
    'は': '📌 Particella tema: pronunciato "wa" (non "ha")',
    'へ': '📌 Particella direzione: pronunciato "e" (non "he")',

    // Vocali lunghe e raddoppi
    'う': '⏱️ Allunga la vocale precedente (es. そう = soo)',
    'い': '⏱️ Allunga la vocale E precedente (es. せい = see)',
    'っ': '⏸️ Piccolo tsu: pausa prima della consonante successiva',

    // R giapponese (flap)
    'ら': '🗣️ R giapponese: tra R, D e L (flap alveolare)',
    'り': '🗣️ R giapponese: tra R, D e L (flap alveolare)',
    'る': '🗣️ R giapponese: tra R, D e L (flap alveolare)',
    'れ': '🗣️ R giapponese: tra R, D e L (flap alveolare)',
    'ろ': '🗣️ R giapponese: tra R, D e L (flap alveolare)',

    // Default generico
    'default': '💡 Pronuncia particolare (passa il mouse per dettagli)'
  };

  return hints[char] || hints['default'];
}

/**
 * Example usage:
 *
 * const tokens = parsePhoneticAnnotations('これはほんで[す]');
 * // [
 * //   { text: 'これはほんで', isAnnotated: false, hint: null },
 * //   { text: 'す', isAnnotated: true, hint: 'La U è molto breve...' }
 * // ]
 *
 * const clean = stripPhoneticMarkers('で[す]'); // "です"
 */
