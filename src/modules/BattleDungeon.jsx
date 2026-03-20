import React, { useState, useEffect, useRef } from 'react';
import useJLPTLevels from '../hooks/useJLPTLevels';
import kanjiMaster from '../database/kanji_master.json';
import sentences from '../database/sentences.json';
import { COMMON_VERBS, conjugateVerb, getAcceptableForms } from '../utils/nihongoEngine';
import { kanaEquals } from '../utils/kanaUtils';

/**
 * BattleDungeon - Wave-based learning challenge culminating in Boss Battle
 * Adapts difficulty based on JLPT level (N5-N1)
 * Wave enemies: Kanji (reading input) + Verbs (conjugation)
 * Boss: Dictation challenge from sentences.json
 */

const GAME_STATES = {
  IDLE: 'IDLE',
  BATTLE: 'BATTLE',
  BOSS: 'BOSS',
  VICTORY: 'VICTORY',
  DEFEAT: 'DEFEAT'
};

const CONJUGATION_FORMS = [
  // FORME PIANE (Dizionario)
  { id: 'present_neg_plain', label: 'Presente Negativo (Piana)', keys: ['present.neg'] },
  { id: 'past_aff_plain', label: 'Passato Affermativo (Piana)', keys: ['past.aff'] },
  { id: 'past_neg_plain', label: 'Passato Negativo (Piana)', keys: ['past.neg'] },
  // FORME CORTESI
  { id: 'present_neg_polite', label: 'Presente Negativo (Cortese)', keys: ['polite.present_neg'] },
  { id: 'past_aff_polite', label: 'Passato Affermativo (Cortese)', keys: ['polite.past'] },
  { id: 'past_neg_polite', label: 'Passato Negativo (Cortese)', keys: ['polite.past_neg'] },
  // ALTRE FORME
  { id: 'te', label: 'Forma Te', keys: ['te'] }
];

/**
 * Configurazione difficoltà per livello JLPT
 */
const DIFFICULTY_CONFIG = {
  N5: { waves: 3, bossHP: 100, playerHP: 100 },
  N4: { waves: 5, bossHP: 150, playerHP: 100 },
  N3: { waves: 7, bossHP: 200, playerHP: 120 },
  N2: { waves: 9, bossHP: 250, playerHP: 120 },
  N1: { waves: 12, bossHP: 300, playerHP: 150 }
};

/**
 * Estrae configurazione basata sui livelli selezionati
 */
function getDifficultyConfig(selectedLevels) {
  if (selectedLevels.length === 0) return DIFFICULTY_CONFIG.N5;

  // Usa il livello più difficile selezionato
  const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];
  for (let i = levels.length - 1; i >= 0; i--) {
    if (selectedLevels.includes(levels[i])) {
      return DIFFICULTY_CONFIG[levels[i]];
    }
  }
  return DIFFICULTY_CONFIG.N5;
}

/**
 * Estrae kanji casuali dai livelli selezionati
 */
function getRandomKanji(selectedLevels) {
  const allKanji = selectedLevels.flatMap(level => kanjiMaster[level] || []);
  if (allKanji.length === 0) return null;
  return allKanji[Math.floor(Math.random() * allKanji.length)];
}

/**
 * Estrae verbo casuale dal database
 */
function getRandomVerb() {
  return COMMON_VERBS[Math.floor(Math.random() * COMMON_VERBS.length)];
}

/**
 * Estrae frase casuale per Boss Battle
 */
function getRandomSentence() {
  if (sentences.length === 0) return null;
  return sentences[Math.floor(Math.random() * sentences.length)];
}

/**
 * Genera nemico casuale per wave (50% Kanji, 50% Verbo)
 */
function generateEnemy(selectedLevels) {
  const isKanjiEnemy = Math.random() < 0.5;

  if (isKanjiEnemy) {
    const kanji = getRandomKanji(selectedLevels);
    if (!kanji) return null;

    // Accetta TUTTE le letture (On + Kun) - Smart Reading Selection
    const onyomiReadings = kanji.onyomi
      ? kanji.onyomi.split('、').map(r => r.trim())
      : [];
    const kunyomiReadings = kanji.kunyomi
      ? kanji.kunyomi.split('、').map(r => r.trim().replace(/[-.]/g, ''))
      : [];

    const allReadings = [...onyomiReadings, ...kunyomiReadings].filter(r => r);

    return {
      type: 'kanji',
      kanji: kanji.kanji,
      question: `Reading (On/Kun accettate)`,
      correctAnswers: allReadings,
      meaning: kanji.meaning,
      damage: 10,
      xpReward: 10
    };
  } else {
    const verb = getRandomVerb();
    const form = CONJUGATION_FORMS[Math.floor(Math.random() * CONJUGATION_FORMS.length)];
    const conjugated = conjugateVerb(verb.reading, verb.type);

    if (!conjugated || !conjugated.forms) {
      console.warn('Coniugazione fallita per:', verb.reading);
      return generateEnemy(selectedLevels); // Retry
    }

    // Usa getAcceptableForms per ottenere tutte le forme valide (piana + cortese)
    const requestedForm = form.keys[0]; // Prendi la prima (ora abbiamo solo una per forma)
    const acceptableForms = getAcceptableForms(conjugated, requestedForm);

    if (!acceptableForms.primary) {
      console.warn(`Nessuna forma valida trovata per:`, verb.reading, form.label);
      return generateEnemy(selectedLevels); // Retry
    }

    return {
      type: 'verb',
      verb: verb.reading,
      verbMeaning: verb.meaning,
      verbType: verb.type,
      question: `Coniuga: ${form.label}`,
      requestedForm: requestedForm,
      correctAnswers: acceptableForms.allAcceptable, // Include piana + cortese
      primaryAnswer: acceptableForms.primary,
      damage: 15,
      xpReward: 15,
      spiritBoost: 10
    };
  }
}

export default function BattleDungeon() {
  const { selectedLevels } = useJLPTLevels();
  const [gameState, setGameState] = useState(GAME_STATES.IDLE);
  const [playerHP, setPlayerHP] = useState(100);
  const [maxPlayerHP, setMaxPlayerHP] = useState(100);
  const [bossHP, setBossHP] = useState(100);
  const [maxBossHP, setMaxBossHP] = useState(100);
  const [currentWave, setCurrentWave] = useState(0);
  const [totalWaves, setTotalWaves] = useState(3);
  const [currentEnemy, setCurrentEnemy] = useState(null);
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [spirit, setSpirit] = useState(0);
  const [xp, setXp] = useState(0);
  const [bossSentence, setBossSentence] = useState(null);
  const [bossUserInput, setBossUserInput] = useState('');
  const [damageFlash, setDamageFlash] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [bossAttempted, setBossAttempted] = useState(false);
  const [bossFeedback, setBossFeedback] = useState(null);
  const [comboCount, setComboCount] = useState(0);
  const [furyMode, setFuryMode] = useState(false);
  const [enemyDefeated, setEnemyDefeated] = useState(false);
  const [usedAlternative, setUsedAlternative] = useState(null);
  const inputRef = useRef(null);
  const audioRef = useRef(null);

  /**
   * Inizializza/Resetta battaglia
   */
  const initializeBattle = () => {
    const config = getDifficultyConfig(selectedLevels);
    setMaxPlayerHP(config.playerHP);
    setPlayerHP(config.playerHP);
    setMaxBossHP(config.bossHP);
    setBossHP(config.bossHP);
    setTotalWaves(config.waves);
    setCurrentWave(0);
    setSpirit(0);
    setXp(0);
    setUserInput('');
    setFeedback(null);
    setCurrentEnemy(null);
    setBossSentence(null);
    setBossUserInput('');
    setBossAttempted(false);
    setBossFeedback(null);
    setDamageFlash(false);
    setAudioPlaying(false);
    setComboCount(0);
    setFuryMode(false);
    setEnemyDefeated(false);
    setUsedAlternative(null);
  };

  /**
   * Inizia nuovo dungeon
   */
  const startDungeon = () => {
    initializeBattle();
    setGameState(GAME_STATES.BATTLE);
    nextWave();
  };

  /**
   * Genera prossima wave
   */
  const nextWave = () => {
    const enemy = generateEnemy(selectedLevels);
    if (!enemy) {
      alert('Nessun contenuto disponibile per i livelli selezionati');
      setGameState(GAME_STATES.IDLE);
      return;
    }
    setCurrentEnemy(enemy);
    setUserInput('');
    setFeedback(null);
  };

  /**
   * Salva nemico nel Diario del Guerriero
   */
  const saveToWarriorJournal = (enemy) => {
    const journal = JSON.parse(localStorage.getItem('recentlyMastered') || '[]');

    const entry = {
      timestamp: Date.now(),
      type: enemy.type,
      content: enemy.type === 'kanji' ? enemy.kanji : enemy.verb,
      reading: enemy.type === 'kanji'
        ? enemy.correctAnswers[0]
        : enemy.correctAnswers[0],
      meaning: enemy.type === 'kanji' ? enemy.meaning : enemy.verbMeaning
    };

    // Aggiungi in cima, mantieni solo ultimi 5
    journal.unshift(entry);
    if (journal.length > 5) journal.pop();

    localStorage.setItem('recentlyMastered', JSON.stringify(journal));
  };

  /**
   * Verifica risposta wave (supporta array di risposte + kana-agnostic + combo system)
   */
  const handleWaveSubmit = (e) => {
    e.preventDefault();
    if (!userInput.trim() || !currentEnemy) return;

    const normalizedInput = userInput.trim();
    const correctAnswers = Array.isArray(currentEnemy.correctAnswers)
      ? currentEnemy.correctAnswers
      : [currentEnemy.correctAnswers];

    const isCorrect = correctAnswers.some(answer => kanaEquals(normalizedInput, answer));

    // Verifica se è stata usata una forma alternativa (per verbi)
    let alternativeUsed = null;
    if (isCorrect && currentEnemy.type === 'verb' && currentEnemy.primaryAnswer) {
      const isPrimary = kanaEquals(normalizedInput, currentEnemy.primaryAnswer);
      if (!isPrimary) {
        // Trova quale alternativa è stata usata
        const matchedAlternative = correctAnswers.find(answer =>
          kanaEquals(normalizedInput, answer) && !kanaEquals(answer, currentEnemy.primaryAnswer)
        );
        if (matchedAlternative) {
          alternativeUsed = matchedAlternative;
        }
      }
    }

    if (isCorrect) {
      setFeedback('correct');
      setUsedAlternative(alternativeUsed);

      // Incrementa combo
      const newCombo = comboCount + 1;
      setComboCount(newCombo);

      // Attiva Fury Mode dopo 5 combo
      if (newCombo >= 5 && !furyMode) {
        setFuryMode(true);
      }

      // Calcola XP con moltiplicatore Fury Mode
      const xpMultiplier = furyMode ? 1.5 : 1;
      const earnedXP = Math.floor(currentEnemy.xpReward * xpMultiplier);
      setXp(prev => prev + earnedXP);

      if (currentEnemy.type === 'verb') {
        setSpirit(prev => Math.min(100, prev + currentEnemy.spiritBoost));
      }

      // Salva nel Diario del Guerriero
      saveToWarriorJournal(currentEnemy);

      // Animazione Sumi-e
      setEnemyDefeated(true);

      setTimeout(() => {
        setEnemyDefeated(false);
        setUsedAlternative(null);
        if (currentWave + 1 >= totalWaves) {
          startBossBattle();
        } else {
          setCurrentWave(prev => prev + 1);
          nextWave();
        }
      }, 1500);
    } else {
      setFeedback('wrong');
      setPlayerHP(prev => Math.max(0, prev - currentEnemy.damage));
      setUsedAlternative(null);

      // Reset combo e Fury Mode
      setComboCount(0);
      setFuryMode(false);

      triggerDamageFlash();

      // Mostra soluzione per 4 secondi per permettere memorizzazione
      setTimeout(() => {
        setFeedback(null);
        setUserInput('');
      }, 4000);
    }
  };

  /**
   * Inizia Boss Battle
   */
  const startBossBattle = () => {
    const sentence = getRandomSentence();
    if (!sentence) {
      setGameState(GAME_STATES.VICTORY);
      return;
    }
    setBossSentence(sentence);
    setBossHP(maxBossHP);
    setBossUserInput('');
    setBossAttempted(false);
    setGameState(GAME_STATES.BOSS);
  };

  /**
   * Verifica input Boss (kana-agnostic + feedback senza spoiler)
   */
  const handleBossSubmit = (e) => {
    e.preventDefault();
    if (!bossSentence) return;

    setBossAttempted(true);

    const correctText = bossSentence.reading || bossSentence.japanese;
    const userText = bossUserInput.trim();

    // Conta caratteri corretti (kana-agnostic per singoli char)
    let correctChars = 0;
    for (let i = 0; i < Math.min(userText.length, correctText.length); i++) {
      if (kanaEquals(userText[i], correctText[i])) correctChars++;
    }

    const accuracy = correctChars / correctText.length;
    const damage = Math.floor(maxBossHP * accuracy * (1 + spirit / 100));

    // Check perfetto con kana-agnostic
    if (kanaEquals(userText, correctText)) {
      // Vittoria perfetta
      setBossHP(0);

      // Salva Boss nel Diario del Guerriero
      const bossEntry = {
        timestamp: Date.now(),
        type: 'boss',
        content: bossSentence.japanese,
        reading: bossSentence.reading,
        meaning: bossSentence.italian || bossSentence.english
      };
      const journal = JSON.parse(localStorage.getItem('recentlyMastered') || '[]');
      journal.unshift(bossEntry);
      if (journal.length > 5) journal.pop();
      localStorage.setItem('recentlyMastered', JSON.stringify(journal));

      setGameState(GAME_STATES.VICTORY);
      saveProgress(xp + 50);
    } else if (accuracy >= 0.7) {
      // Danno parziale
      setBossHP(prev => {
        const newHP = Math.max(0, prev - damage);
        if (newHP === 0) {
          // Salva Boss nel Diario del Guerriero
          const bossEntry = {
            timestamp: Date.now(),
            type: 'boss',
            content: bossSentence.japanese,
            reading: bossSentence.reading,
            meaning: bossSentence.italian || bossSentence.english
          };
          const journal = JSON.parse(localStorage.getItem('recentlyMastered') || '[]');
          journal.unshift(bossEntry);
          if (journal.length > 5) journal.pop();
          localStorage.setItem('recentlyMastered', JSON.stringify(journal));

          setGameState(GAME_STATES.VICTORY);
          saveProgress(xp + 30);
        }
        return newHP;
      });
      setBossFeedback({ type: 'partial', correctChars, totalChars: correctText.length });
      setBossUserInput('');
      setTimeout(() => setBossFeedback(null), 2000);
    } else {
      // Danno al player - NO SPOILER, solo feedback generico
      setPlayerHP(prev => Math.max(0, prev - 20));
      triggerDamageFlash();
      setBossFeedback({ type: 'wrong', correctChars, totalChars: correctText.length });
      setBossUserInput('');
      setTimeout(() => setBossFeedback(null), 2000);
    }
  };

  /**
   * Flash rosso danno
   */
  const triggerDamageFlash = () => {
    setDamageFlash(true);
    setTimeout(() => setDamageFlash(false), 200);
  };

  /**
   * Salva progresso
   */
  const saveProgress = (finalXP) => {
    // Salva XP totale
    const currentXP = parseInt(localStorage.getItem('nihongo_sensei_xp') || '0', 10);
    const newXP = currentXP + finalXP;
    localStorage.setItem('nihongo_sensei_xp', newXP.toString());

    // Salva statistiche dungeon
    const progress = JSON.parse(localStorage.getItem('player_progress') || '{}');
    progress.dungeonsCleared = (progress.dungeonsCleared || 0) + 1;
    progress.lastClear = new Date().toISOString();
    localStorage.setItem('player_progress', JSON.stringify(progress));
  };

  /**
   * Check sconfitta
   */
  useEffect(() => {
    if (playerHP <= 0 && gameState !== GAME_STATES.IDLE) {
      setGameState(GAME_STATES.DEFEAT);
    }
  }, [playerHP, gameState]);

  /**
   * Focus input
   */
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentEnemy, gameState]);

  /**
   * RENDER: Idle Screen
   */
  if (gameState === GAME_STATES.IDLE) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-bold text-stone-800 mb-4">⚔️ Battle Dungeon</h1>
          <p className="text-stone-600 mb-6">
            Affronta ondate di nemici (Kanji + Verbi) e sconfiggi il Boss finale con un dettato perfetto.
          </p>
          <div className="bg-white p-4 rounded-lg shadow mb-6">
            <p className="text-sm text-stone-500 mb-2">Livelli selezionati: {selectedLevels.join(', ') || 'Nessuno'}</p>
            <p className="text-sm text-stone-500">Ondate: {getDifficultyConfig(selectedLevels).waves}</p>
          </div>
          <button
            onClick={startDungeon}
            disabled={selectedLevels.length === 0}
            className="bg-red-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-red-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition"
          >
            Inizia Dungeon
          </button>
          {selectedLevels.length === 0 && (
            <p className="text-red-500 text-sm mt-3">Seleziona almeno un livello JLPT in Settings</p>
          )}
        </div>
      </div>
    );
  }

  /**
   * RENDER: Victory Screen
   */
  if (gameState === GAME_STATES.VICTORY) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-8">
        <div className="text-center max-w-2xl">
          <h1 className="text-5xl font-bold text-green-700 mb-4">🎉 Vittoria!</h1>
          <p className="text-2xl text-stone-700 mb-6">XP Guadagnata: {xp}</p>

          {/* Mostra frase Boss se vittoria durante Boss Battle */}
          {bossSentence && (
            <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
              <p className="text-sm text-green-600 mb-3 font-bold">✅ Frase Completata:</p>
              <div className="space-y-2">
                <p className="text-2xl font-bold text-stone-800">{bossSentence.japanese}</p>
                <p className="text-lg text-blue-600">{bossSentence.reading}</p>
                <p className="text-md text-stone-600 italic">{bossSentence.italian}</p>
                {bossSentence.english && (
                  <p className="text-md text-stone-500 italic">{bossSentence.english}</p>
                )}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              initializeBattle();
              setGameState(GAME_STATES.IDLE);
            }}
            className="bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 transition"
          >
            Torna al Menu
          </button>
        </div>
      </div>
    );
  }

  /**
   * RENDER: Defeat Screen
   */
  if (gameState === GAME_STATES.DEFEAT) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-8">
        <div className="text-center max-w-2xl">
          <h1 className="text-5xl font-bold text-red-700 mb-4">🍂 Sconfitta</h1>
          <p className="text-xl text-stone-700 mb-6">XP Guadagnata: {xp}</p>

          {/* Mostra frase corretta se sconfitto al Boss */}
          {bossSentence && (
            <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
              <p className="text-sm text-stone-500 mb-3">📖 Frase Corretta:</p>
              <div className="space-y-2">
                <p className="text-2xl font-bold text-stone-800">{bossSentence.japanese}</p>
                <p className="text-lg text-blue-600">{bossSentence.reading}</p>
                <p className="text-md text-stone-600 italic">{bossSentence.italian}</p>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              initializeBattle();
              setGameState(GAME_STATES.IDLE);
            }}
            className="bg-red-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-red-700 transition"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  /**
   * RENDER: Boss Battle
   */
  if (gameState === GAME_STATES.BOSS) {
    return (
      <div className={`min-h-screen bg-stone-100 p-8 transition ${damageFlash ? 'bg-red-200' : ''}`}>
        {/* HP Bars */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="flex justify-between items-center mb-4">
            <div className="flex-1 mr-4">
              <div className="flex justify-between text-sm text-stone-600 mb-1">
                <span>Player HP</span>
                <span>{playerHP}/{maxPlayerHP}</span>
              </div>
              <div className="h-4 bg-stone-300 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${(playerHP / maxPlayerHP) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-sm text-stone-600 mb-1">
                <span>Boss HP</span>
                <span>{bossHP}/{maxBossHP}</span>
              </div>
              <div className="h-4 bg-stone-300 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-600 transition-all duration-300"
                  style={{ width: `${(bossHP / maxBossHP) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Spirit Bar */}
          <div className="mb-2">
            <div className="flex justify-between text-sm text-stone-600 mb-1">
              <span>Spirit (Danno x{(1 + spirit/100).toFixed(2)})</span>
              <span>{spirit}%</span>
            </div>
            <div className="h-2 bg-stone-300 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${spirit}%` }}
              />
            </div>
          </div>
        </div>

        {/* Boss Content */}
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-lg">
          <h2 className="text-3xl font-bold text-red-600 text-center mb-6">👹 Boss Battle</h2>

          {bossSentence && (
            <div className="mb-6">
              <p className="text-sm text-stone-500 mb-4">Ascolta e scrivi la frase (nessun hint visivo):</p>

              <button
                onClick={() => {
                  setAudioPlaying(true);

                  // Prova prima con file audio
                  const audio = new Audio(`/audio/dictation/${bossSentence.id}.mp3`);
                  audioRef.current = audio;

                  audio.addEventListener('ended', () => setAudioPlaying(false));
                  audio.addEventListener('error', () => {
                    setAudioPlaying(false);
                    // Fallback: Web Speech API con READING hiragana (mai kanji)
                    const textToSpeak = bossSentence.reading || bossSentence.japanese;
                    const utterance = new SpeechSynthesisUtterance(textToSpeak);
                    utterance.lang = 'ja-JP';
                    utterance.rate = 0.8; // Rallenta per dettato
                    utterance.onend = () => setAudioPlaying(false);
                    speechSynthesis.speak(utterance);
                  });

                  audio.play().catch(() => {
                    // Gestione errore diretto (file non trovato)
                    setAudioPlaying(false);
                    const textToSpeak = bossSentence.reading || bossSentence.japanese;
                    const utterance = new SpeechSynthesisUtterance(textToSpeak);
                    utterance.lang = 'ja-JP';
                    utterance.rate = 0.8;
                    utterance.onend = () => setAudioPlaying(false);
                    speechSynthesis.speak(utterance);
                  });
                }}
                disabled={audioPlaying}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition mb-4 disabled:bg-blue-300 disabled:cursor-not-allowed"
              >
                {audioPlaying ? '🔊 Riproduzione...' : '🔊 Riproduci Audio'}
              </button>
            </div>
          )}

          <form onSubmit={handleBossSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={bossUserInput}
              onChange={(e) => setBossUserInput(e.target.value)}
              placeholder="Scrivi la frase..."
              className="w-full p-4 border-2 border-stone-300 rounded-lg text-lg mb-4 focus:border-red-500 focus:outline-none"
            />
            <button
              type="submit"
              className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition"
            >
              Attacca Boss
            </button>
          </form>

          {/* Feedback senza spoiler */}
          {bossFeedback && (
            <div className={`mt-4 p-4 rounded-lg text-center ${
              bossFeedback.type === 'partial' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
            }`}>
              <p className="font-bold">
                {bossFeedback.type === 'partial' ? '⚡ Danno parziale!' : '✗ Troppo impreciso! -20 HP'}
              </p>
              <p className="text-sm mt-2">
                Caratteri corretti: {bossFeedback.correctChars} / {bossFeedback.totalChars}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  /**
   * RENDER: Wave Battle
   */
  return (
    <div className={`min-h-screen bg-stone-100 p-8 transition ${damageFlash ? 'bg-red-200' : ''}`}>
      {/* HP Bar */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex justify-between text-sm text-stone-600 mb-1">
          <span>Player HP</span>
          <span>{playerHP}/{maxPlayerHP}</span>
        </div>
        <div className="h-4 bg-stone-300 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              furyMode
                ? 'bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-500 shadow-lg'
                : 'bg-green-500'
            }`}
            style={{ width: `${(playerHP / maxPlayerHP) * 100}%` }}
          />
        </div>

        {/* Wave Progress */}
        <div className="mt-4 flex justify-between items-center">
          <span className="text-stone-600">Ondata {currentWave + 1} / {totalWaves}</span>
          <span className="text-blue-600 font-bold">Spirit: {spirit}%</span>
          <span className="text-yellow-600 font-bold">XP: {xp}</span>
        </div>

        {/* Combo Counter */}
        <div className="mt-4 text-center">
          <div className={`inline-block px-4 py-2 rounded-lg transition-all ${
            furyMode
              ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-lg animate-pulse'
              : comboCount > 0
              ? 'bg-blue-100 text-blue-800'
              : 'bg-stone-200 text-stone-500'
          }`}>
            {furyMode ? (
              <span className="font-bold text-lg">🔥 FURY MODE! Combo: {comboCount} | XP x1.5</span>
            ) : comboCount > 0 ? (
              <span className="font-bold">Combo: {comboCount} {comboCount >= 3 ? '🔥' : ''}</span>
            ) : (
              <span>Nessuna combo</span>
            )}
          </div>
        </div>
      </div>

      {/* Enemy */}
      {currentEnemy && (
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-lg">
          {/* Animazione Sumi-e */}
          <div
            className={`transition-all duration-1000 ${
              enemyDefeated
                ? 'opacity-0 scale-150 blur-md'
                : 'opacity-100 scale-100 blur-0'
            }`}
            style={{
              filter: enemyDefeated ? 'blur(8px)' : 'blur(0)',
              transform: enemyDefeated ? 'scale(1.5)' : 'scale(1)'
            }}
          >
            {currentEnemy.type === 'kanji' ? (
              <div className="text-center mb-6">
                <h2 className="text-6xl font-bold text-stone-800 mb-4">{currentEnemy.kanji}</h2>
                <p className="text-stone-500 mb-2">{currentEnemy.meaning}</p>
                <p className="text-lg font-bold text-red-600">{currentEnemy.question}</p>
              </div>
            ) : (
              <div className="text-center mb-6">
                <h2 className="text-4xl font-bold text-stone-800 mb-2">{currentEnemy.verb}</h2>
                <p className="text-stone-500 mb-4">{currentEnemy.verbMeaning}</p>
                <p className="text-lg font-bold text-purple-600">{currentEnemy.question}</p>
              </div>
            )}
          </div>

          <form onSubmit={handleWaveSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Scrivi la risposta..."
              disabled={feedback !== null}
              className="w-full p-4 border-2 border-stone-300 rounded-lg text-lg mb-4 focus:border-blue-500 focus:outline-none disabled:bg-stone-100"
            />
            <button
              type="submit"
              disabled={feedback !== null}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-stone-300 transition"
            >
              Verifica
            </button>
          </form>

          {feedback === 'correct' && (
            <div className="mt-4 space-y-2">
              <div className="p-4 bg-green-100 text-green-800 rounded-lg text-center font-bold animate-pulse">
                ✓ Corretto! +{currentEnemy.xpReward} XP
              </div>
              {usedAlternative && currentEnemy.type === 'verb' && (
                <div className="p-3 bg-blue-50 border-2 border-blue-200 rounded-lg text-sm">
                  <div className="font-semibold text-blue-700 mb-1">
                    📚 Hai usato una forma alternativa valida!
                  </div>
                  <div className="text-gray-700 text-xs">
                    <span className="text-blue-600 font-bold">{usedAlternative}</span> = <span className="text-blue-600 font-bold">{currentEnemy.primaryAnswer}</span>
                    <div className="text-gray-500 mt-1">(Forma piana e cortese sono entrambe corrette)</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {feedback === 'wrong' && currentEnemy && (
            <div className="mt-4 p-4 bg-red-100 text-red-800 rounded-lg text-center">
              <p className="font-bold">✗ Sbagliato! -{currentEnemy.damage} HP</p>
              <p className="text-sm mt-2">
                {Array.isArray(currentEnemy.correctAnswers) && currentEnemy.correctAnswers.length > 1
                  ? `Risposte corrette: ${currentEnemy.correctAnswers.join(' / ')}`
                  : `Risposta corretta: ${Array.isArray(currentEnemy.correctAnswers) ? currentEnemy.correctAnswers[0] : currentEnemy.correctAnswers}`
                }
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
