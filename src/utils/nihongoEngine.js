/**
 * Nihongo Sensei - Japanese Verb Conjugation Engine
 * Supporta Godan (五段), Ichidan (一段), e verbi irregolari
 */

/**
 * Hiragana mapping per stem changes (Godan verbs)
 */
const HIRAGANA_ROWS = {
  'う': { a: 'わ', i: 'い', u: 'う', e: 'え', o: 'お' },
  'く': { a: 'か', i: 'き', u: 'く', e: 'け', o: 'こ' },
  'ぐ': { a: 'が', i: 'ぎ', u: 'ぐ', e: 'げ', o: 'ご' },
  'す': { a: 'さ', i: 'し', u: 'す', e: 'せ', o: 'そ' },
  'つ': { a: 'た', i: 'ち', u: 'つ', e: 'て', o: 'と' },
  'ぬ': { a: 'な', i: 'に', u: 'ぬ', e: 'ね', o: 'の' },
  'ぶ': { a: 'ば', i: 'び', u: 'ぶ', e: 'べ', o: 'ぼ' },
  'む': { a: 'ま', i: 'み', u: 'む', e: 'め', o: 'も' },
  'る': { a: 'ら', i: 'り', u: 'る', e: 'れ', o: 'ろ' }
};

/**
 * Te-form endings per consonante finale (Godan)
 */
const TE_FORM_MAP = {
  'う': 'って', 'つ': 'って', 'る': 'って',
  'む': 'んで', 'ぬ': 'んで', 'ぶ': 'んで',
  'く': 'いて', 'ぐ': 'いで',
  'す': 'して'
};

/**
 * Past plain form endings per consonante finale (Godan)
 * Segue le stesse regole di TE form ma con た/だ invece di て/で
 */
const PAST_PLAIN_MAP = {
  'う': 'った', 'つ': 'った', 'る': 'った',
  'む': 'んだ', 'ぬ': 'んだ', 'ぶ': 'んだ',
  'く': 'いた', 'ぐ': 'いだ',
  'す': 'した'
};

/**
 * Verbi irregolari hardcoded
 * Chiavi sia in kanji che hiragana per supportare entrambi
 */
const IRREGULAR_VERBS = {
  'する': {
    present: { aff: 'する', neg: 'しない' },
    past: { aff: 'した', neg: 'しなかった' },
    te: 'して',
    potential: 'できる',
    causative: 'させる',
    passive: 'される',
    polite: {
      present: 'します',
      present_neg: 'しません',
      past: 'しました',
      past_neg: 'しませんでした'
    }
  },
  '来る': {
    present: { aff: '来る', neg: '来ない' },
    past: { aff: '来た', neg: '来なかった' },
    te: '来て',
    potential: '来られる',
    causative: '来させる',
    passive: '来られる',
    polite: {
      present: '来ます',
      present_neg: '来ません',
      past: '来ました',
      past_neg: '来ませんでした'
    }
  },
  // Versioni hiragana per input utente
  'くる': {
    present: { aff: 'くる', neg: 'こない' },
    past: { aff: 'きた', neg: 'こなかった' },
    te: 'きて',
    potential: 'こられる',
    causative: 'こさせる',
    passive: 'こられる',
    polite: {
      present: 'きます',
      present_neg: 'きません',
      past: 'きました',
      past_neg: 'きませんでした'
    }
  },
  // Verbi composti con する
  'べんきょうする': {
    present: { aff: 'べんきょうする', neg: 'べんきょうしない' },
    past: { aff: 'べんきょうした', neg: 'べんきょうしなかった' },
    te: 'べんきょうして',
    potential: 'べんきょうできる',
    causative: 'べんきょうさせる',
    passive: 'べんきょうされる',
    polite: {
      present: 'べんきょうします',
      present_neg: 'べんきょうしません',
      past: 'べんきょうしました',
      past_neg: 'べんきょうしませんでした'
    }
  }
};

/**
 * Identifica tipo di verbo
 * @param {string} verb - Verbo in forma dizionario (kanji o hiragana)
 * @returns {'godan'|'ichidan'|'irregular'|'unknown'}
 */
export function identifyVerbType(verb) {
  if (!verb || verb.length < 2) return 'unknown';

  // Check se è irregolare (supporta sia kanji che hiragana)
  if (IRREGULAR_VERBS[verb]) return 'irregular';

  const lastChar = verb.slice(-1);
  const penultimateChar = verb.slice(-2, -1);

  // Ichidan: termina in える o いる
  if (lastChar === 'る') {
    if (penultimateChar === 'え' || penultimateChar === 'い') {
      return 'ichidan'; // Possibile Ichidan (necessita contesto)
    }
  }

  // Godan: tutte le altre terminazioni
  if (HIRAGANA_ROWS[lastChar]) {
    return 'godan';
  }

  return 'unknown';
}

/**
 * Coniuga verbo Godan
 * @param {string} verb - Verbo in forma dizionario
 * @returns {object} - Tutte le forme coniugate
 */
function conjugateGodan(verb) {
  const lastChar = verb.slice(-1);
  const stem = verb.slice(0, -1);
  const row = HIRAGANA_ROWS[lastChar];

  if (!row) throw new Error(`Carattere finale non valido: ${lastChar}`);

  return {
    present: {
      aff: verb,
      neg: stem + row.a + 'ない'
    },
    past: {
      aff: stem + (PAST_PLAIN_MAP[lastChar] || 'った'),  // FORMA PIANA: った, んだ, いた, ecc.
      neg: stem + row.a + 'なかった'
    },
    te: stem + (TE_FORM_MAP[lastChar] || 'って'),
    potential: stem + row.e + 'る',
    causative: stem + row.a + 'せる',
    passive: stem + row.a + 'れる',
    polite: {
      present: stem + row.i + 'ます',
      present_neg: stem + row.i + 'ません',
      past: stem + row.i + 'ました',  // FORMA CORTESE: sempre ~ました
      past_neg: stem + row.i + 'ませんでした'
    }
  };
}

/**
 * Coniuga verbo Ichidan
 * @param {string} verb - Verbo in forma dizionario (es. 食べる)
 * @returns {object} - Tutte le forme coniugate
 */
function conjugateIchidan(verb) {
  const stem = verb.slice(0, -1); // Rimuovi る

  return {
    present: {
      aff: verb,
      neg: stem + 'ない'
    },
    past: {
      aff: stem + 'た',
      neg: stem + 'なかった'
    },
    te: stem + 'て',
    potential: stem + 'られる',
    causative: stem + 'させる',
    passive: stem + 'られる',
    polite: {
      present: stem + 'ます',
      present_neg: stem + 'ません',
      past: stem + 'ました',
      past_neg: stem + 'ませんでした'
    }
  };
}

/**
 * Coniuga qualsiasi verbo (auto-detect tipo)
 * @param {string} verb - Verbo in forma dizionario (kanji o hiragana)
 * @param {string} [forceType] - Forza tipo: 'godan'|'ichidan'|'irregular'
 * @returns {object|null} - Forme coniugate con metadata, o null se fallisce
 */
export function conjugateVerb(verb, forceType = null) {
  if (!verb) return null;

  const type = forceType || identifyVerbType(verb);

  if (type === 'irregular') {
    const irregularForms = IRREGULAR_VERBS[verb];
    if (!irregularForms) {
      console.error(`Verbo irregolare non trovato nella tabella: ${verb}`);
      return null;
    }
    return {
      verb,
      type: 'irregular',
      forms: irregularForms
    };
  }

  if (type === 'ichidan') {
    try {
      return {
        verb,
        type: 'ichidan',
        forms: conjugateIchidan(verb)
      };
    } catch (error) {
      console.error(`Errore coniugazione Ichidan: ${verb}`, error);
      return null;
    }
  }

  if (type === 'godan') {
    try {
      return {
        verb,
        type: 'godan',
        forms: conjugateGodan(verb)
      };
    } catch (error) {
      console.error(`Errore coniugazione Godan: ${verb}`, error);
      return null;
    }
  }

  console.warn(`Tipo verbo sconosciuto: ${verb} (tipo: ${type})`);
  return null;
}

/**
 * Dataset verbi comuni N5/N4 per testing/flashcards
 * Ogni verbo DEVE avere: verb (kanji), reading (hiragana), meaning (italiano), type
 */
export const COMMON_VERBS = [
  // === ICHIDAN (一段) ===
  { verb: '食べる', reading: 'たべる', meaning: 'mangiare', type: 'ichidan' },
  { verb: '見る', reading: 'みる', meaning: 'vedere', type: 'ichidan' },
  { verb: '起きる', reading: 'おきる', meaning: 'svegliarsi', type: 'ichidan' },
  { verb: '寝る', reading: 'ねる', meaning: 'dormire', type: 'ichidan' },
  { verb: '開ける', reading: 'あける', meaning: 'aprire', type: 'ichidan' },
  { verb: '閉める', reading: 'しめる', meaning: 'chiudere', type: 'ichidan' },
  { verb: '着る', reading: 'きる', meaning: 'indossare', type: 'ichidan' },
  { verb: '教える', reading: 'おしえる', meaning: 'insegnare', type: 'ichidan' },
  { verb: '忘れる', reading: 'わすれる', meaning: 'dimenticare', type: 'ichidan' },
  { verb: '覚える', reading: 'おぼえる', meaning: 'ricordare/memorizzare', type: 'ichidan' },
  { verb: '考える', reading: 'かんがえる', meaning: 'pensare', type: 'ichidan' },
  { verb: 'いる', reading: 'いる', meaning: 'esserci (animato)', type: 'ichidan' },
  { verb: '見せる', reading: 'みせる', meaning: 'mostrare', type: 'ichidan' },
  { verb: '出る', reading: 'でる', meaning: 'uscire', type: 'ichidan' },
  { verb: '疲れる', reading: 'つかれる', meaning: 'stancarsi', type: 'ichidan' },

  // === GODAN (五段) ===
  { verb: '書く', reading: 'かく', meaning: 'scrivere', type: 'godan' },
  { verb: '読む', reading: 'よむ', meaning: 'leggere', type: 'godan' },
  { verb: '話す', reading: 'はなす', meaning: 'parlare', type: 'godan' },
  { verb: '行く', reading: 'いく', meaning: 'andare', type: 'godan' },
  { verb: '飲む', reading: 'のむ', meaning: 'bere', type: 'godan' },
  { verb: '聞く', reading: 'きく', meaning: 'ascoltare/chiedere', type: 'godan' },
  { verb: '帰る', reading: 'かえる', meaning: 'tornare a casa', type: 'godan' },
  { verb: '買う', reading: 'かう', meaning: 'comprare', type: 'godan' },
  { verb: '待つ', reading: 'まつ', meaning: 'aspettare', type: 'godan' },
  { verb: '遊ぶ', reading: 'あそぶ', meaning: 'giocare', type: 'godan' },
  { verb: '泳ぐ', reading: 'およぐ', meaning: 'nuotare', type: 'godan' },
  { verb: '使う', reading: 'つかう', meaning: 'usare', type: 'godan' },
  { verb: '作る', reading: 'つくる', meaning: 'creare/cucinare', type: 'godan' },
  { verb: '会う', reading: 'あう', meaning: 'incontrare', type: 'godan' },
  { verb: '言う', reading: 'いう', meaning: 'dire', type: 'godan' },
  { verb: '知る', reading: 'しる', meaning: 'sapere/conoscere', type: 'godan' },
  { verb: '住む', reading: 'すむ', meaning: 'abitare', type: 'godan' },
  { verb: '持つ', reading: 'もつ', meaning: 'tenere/possedere', type: 'godan' },
  { verb: '立つ', reading: 'たつ', meaning: 'stare in piedi', type: 'godan' },
  { verb: '座る', reading: 'すわる', meaning: 'sedersi', type: 'godan' },
  { verb: '歩く', reading: 'あるく', meaning: 'camminare', type: 'godan' },
  { verb: '走る', reading: 'はしる', meaning: 'correre', type: 'godan' },
  { verb: '入る', reading: 'はいる', meaning: 'entrare', type: 'godan' },
  { verb: '脱ぐ', reading: 'ぬぐ', meaning: 'togliersi (vestiti)', type: 'godan' },
  { verb: '洗う', reading: 'あらう', meaning: 'lavare', type: 'godan' },
  { verb: '働く', reading: 'はたらく', meaning: 'lavorare', type: 'godan' },
  { verb: '休む', reading: 'やすむ', meaning: 'riposare', type: 'godan' },
  { verb: '終わる', reading: 'おわる', meaning: 'finire (intrans.)', type: 'godan' },
  { verb: '始まる', reading: 'はじまる', meaning: 'iniziare (intrans.)', type: 'godan' },
  { verb: '消す', reading: 'けす', meaning: 'spegnere', type: 'godan' },
  { verb: '降る', reading: 'ふる', meaning: 'cadere (pioggia)', type: 'godan' },
  { verb: '吹く', reading: 'ふく', meaning: 'soffiare (vento)', type: 'godan' },
  { verb: '止まる', reading: 'とまる', meaning: 'fermarsi', type: 'godan' },
  { verb: '渡る', reading: 'わたる', meaning: 'attraversare', type: 'godan' },
  { verb: '乗る', reading: 'のる', meaning: 'salire (su veicolo)', type: 'godan' },
  { verb: '降りる', reading: 'おりる', meaning: 'scendere', type: 'godan' },
  { verb: '売る', reading: 'うる', meaning: 'vendere', type: 'godan' },
  { verb: '貸す', reading: 'かす', meaning: 'prestare', type: 'godan' },
  { verb: '借りる', reading: 'かりる', meaning: 'prendere in prestito', type: 'godan' },
  { verb: '思う', reading: 'おもう', meaning: 'pensare/credere', type: 'godan' },
  { verb: 'わかる', reading: 'わかる', meaning: 'capire', type: 'godan' },
  { verb: 'ある', reading: 'ある', meaning: 'esserci (inanimato)', type: 'godan' },
  { verb: '撮る', reading: 'とる', meaning: 'fotografare', type: 'godan' },
  { verb: '取る', reading: 'とる', meaning: 'prendere', type: 'godan' },
  { verb: '送る', reading: 'おくる', meaning: 'inviare', type: 'godan' },
  { verb: '習う', reading: 'ならう', meaning: 'imparare (studiare)', type: 'godan' },
  { verb: '払う', reading: 'はらう', meaning: 'pagare', type: 'godan' },
  { verb: '歌う', reading: 'うたう', meaning: 'cantare', type: 'godan' },
  { verb: '切る', reading: 'きる', meaning: 'tagliare', type: 'godan' },
  { verb: '死ぬ', reading: 'しぬ', meaning: 'morire', type: 'godan' },

  // === IRREGULAR (不規則) ===
  { verb: 'する', reading: 'する', meaning: 'fare', type: 'irregular' },
  { verb: '来る', reading: 'くる', meaning: 'venire', type: 'irregular' },
  { verb: '勉強する', reading: 'べんきょうする', meaning: 'studiare', type: 'irregular' }
];

/**
 * Restituisce tutte le forme accettabili per una data coniugazione
 * Include sia forma piana che cortese quando applicabile
 * @param {object} conjugated - Risultato di conjugateVerb()
 * @param {string} requestedForm - Forma richiesta (es. 'past.aff', 'polite.present')
 * @returns {object} - { primary: string, alternatives: string[], allAcceptable: string[] }
 */
export function getAcceptableForms(conjugated, requestedForm) {
  if (!conjugated || !conjugated.forms) return { primary: null, alternatives: [], allAcceptable: [] };

  const formPath = requestedForm.split('.');
  let primary = conjugated.forms;

  // Naviga la struttura nested
  for (const key of formPath) {
    if (!primary || primary[key] === undefined) {
      return { primary: null, alternatives: [], allAcceptable: [] };
    }
    primary = primary[key];
  }

  // Determina forme alternative
  const alternatives = [];

  // Se è richiesta una forma piana, aggiungi cortese equivalente
  if (requestedForm === 'present.aff') {
    alternatives.push(conjugated.forms.polite?.present);
  } else if (requestedForm === 'present.neg') {
    alternatives.push(conjugated.forms.polite?.present_neg);
  } else if (requestedForm === 'past.aff') {
    alternatives.push(conjugated.forms.polite?.past);
  } else if (requestedForm === 'past.neg') {
    alternatives.push(conjugated.forms.polite?.past_neg);
  }

  // Se è richiesta una forma cortese, aggiungi piana equivalente
  else if (requestedForm === 'polite.present') {
    alternatives.push(conjugated.forms.present?.aff);
  } else if (requestedForm === 'polite.present_neg') {
    alternatives.push(conjugated.forms.present?.neg);
  } else if (requestedForm === 'polite.past') {
    alternatives.push(conjugated.forms.past?.aff);
  } else if (requestedForm === 'polite.past_neg') {
    alternatives.push(conjugated.forms.past?.neg);
  }

  // Rimuovi undefined/null
  const validAlternatives = alternatives.filter(Boolean);

  return {
    primary,
    alternatives: validAlternatives,
    allAcceptable: [primary, ...validAlternatives]
  };
}

/**
 * Genera quiz di coniugazione random
 * IMPORTANTE: Le risposte sono in HIRAGANA per permettere verifica scrittura
 * @param {number} count - Numero di domande
 * @returns {Array} - Quiz con verbo + forma richiesta
 */
export function generateConjugationQuiz(count = 10) {
  const forms = ['polite.present', 'te', 'past.aff'];
  const quiz = [];
  let attempts = 0;
  const maxAttempts = count * 3; // Evita loop infinito

  while (quiz.length < count && attempts < maxAttempts) {
    attempts++;

    try {
      const verbData = COMMON_VERBS[Math.floor(Math.random() * COMMON_VERBS.length)];

      // Validation: verifica che il verbo abbia tutti i campi necessari
      if (!verbData || !verbData.verb || !verbData.reading || !verbData.type) {
        console.warn('Verbo incompleto:', verbData);
        continue;
      }

      const form = forms[Math.floor(Math.random() * forms.length)];

      // Coniuga usando la READING (hiragana) invece del kanji
      const conjugated = conjugateVerb(verbData.reading, verbData.type);

      // Validation: verifica che la coniugazione sia riuscita
      if (!conjugated || !conjugated.forms) {
        console.warn('Coniugazione fallita per:', verbData.reading);
        continue;
      }

      // Parse nested form (es. 'polite.present' -> conjugated.forms.polite.present)
      const formPath = form.split('.');
      let answer = conjugated.forms;

      for (const key of formPath) {
        if (!answer || answer[key] === undefined) {
          console.warn(`Forma ${form} non trovata per verbo:`, verbData.reading);
          answer = null;
          break;
        }
        answer = answer[key];
      }

      // Skip se la risposta non è valida
      if (!answer) continue;

      quiz.push({
        verb: verbData.verb,           // Kanji per visualizzazione
        reading: verbData.reading,     // Hiragana
        meaning: verbData.meaning,
        requestedForm: form,
        answer,                        // Risposta corretta in HIRAGANA
        type: verbData.type
      });

    } catch (error) {
      console.error('Errore generazione quiz:', error);
      continue;
    }
  }

  // Fallback: se non siamo riusciti a generare abbastanza domande
  if (quiz.length === 0) {
    console.error('ERRORE CRITICO: Impossibile generare quiz verbi');
    // Genera almeno una domanda di fallback con する
    quiz.push({
      verb: 'する',
      reading: 'する',
      meaning: 'fare',
      requestedForm: 'polite.present',
      answer: 'します',
      type: 'irregular'
    });
  }

  return quiz;
}
