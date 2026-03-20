import React, { useState, useRef, useEffect } from 'react';
import translationsData from '../database/translations_n5.json';
import { normalizeKana, kanaEquals } from '../utils/kanaUtils';
import useSessionStats from '../hooks/useSessionStats';
import LiveFeedbackInput from '../components/LiveFeedbackInput';

/**
 * TranslationDojo - Traduzione attiva IT↔JP (N5 Masu)
 */
export default function TranslationDojo() {
  const [mode, setMode] = useState('IT_TO_JP'); // IT_TO_JP | JP_TO_IT
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [showFurigana, setShowFurigana] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [shuffledTranslations, setShuffledTranslations] = useState([]);
  const [failedTranslations, setFailedTranslations] = useState({});
  const [checkedItem, setCheckedItem] = useState(null); // Salva item al momento della verifica
  const [audioPlaying, setAudioPlaying] = useState(false);

  const { completedIds, completedCount, markCompleted, resetSession } = useSessionStats('translation-dojo');
  const audioRef = useRef(null);
  const isSpeaking = useRef(false); // Lucchetto anti-doppia esecuzione

  // Load failed translations from localStorage e shuffle SOLO all'inizio
  useEffect(() => {
    const stored = localStorage.getItem('translation-dojo-failed');
    const failed = stored ? JSON.parse(stored) : {};
    setFailedTranslations(failed);

    // Shuffle con SRS priority (SOLO all'inizio)
    const applyWeightedShuffle = (data) => {
      const weighted = [];
      data.forEach(item => {
        const failCount = failed[item.id]?.count || 0;
        const repetitions = Math.min(failCount + 1, 3);
        for (let i = 0; i < repetitions; i++) {
          weighted.push(item);
        }
      });
      return weighted.sort(() => Math.random() - 0.5);
    };
    setShuffledTranslations(applyWeightedShuffle(translationsData));

    // Precarica voci TTS (alcuni browser le caricano in modo asincrono)
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []); // EMPTY deps: shuffle solo al mount

  const currentItem = shuffledTranslations[currentIndex] || translationsData[0];

  /**
   * Validazione doppia: accetta sia Kanji che Hiragana
   */
  const validateAnswer = (input, item) => {
    const normalized = input.trim().replace(/[。、！？!?,\.]/g, '');

    if (mode === 'IT_TO_JP') {
      // Accetta risposta corretta (con kanji)
      if (normalizeKana(normalized) === normalizeKana(item.japanese.replace(/[。、！？!?,\.]/g, ''))) {
        return true;
      }

      // Accetta lettura (solo hiragana/katakana)
      if (normalizeKana(normalized) === normalizeKana(item.reading.replace(/[。、！？!?,\.]/g, ''))) {
        return true;
      }

      // Accetta alternative
      if (item.alternatives && item.alternatives.length > 0) {
        return item.alternatives.some(alt =>
          normalizeKana(normalized) === normalizeKana(alt.replace(/[。、！？!?,\.]/g, ''))
        );
      }

      return false;
    } else {
      // JP_TO_IT: keyword matching flessibile
      const inputLower = normalized.toLowerCase();
      const targetLower = item.italian.toLowerCase().replace(/[。、！？!?,\.]/g, '');

      // Exact match
      if (inputLower === targetLower) return true;

      // Keyword matching (almeno il 70% delle parole chiave)
      const keywords = targetLower.split(/\s+/).filter(w => w.length > 2);
      if (keywords.length === 0) return inputLower === targetLower;

      const matchedKeywords = keywords.filter(kw => inputLower.includes(kw));
      return matchedKeywords.length >= Math.ceil(keywords.length * 0.7);
    }
  };

  const handleCheck = () => {
    const correct = validateAnswer(userInput, currentItem);
    setIsCorrect(correct);
    setShowResult(true);
    setCheckedItem(currentItem); // Salva item corrente per feedback sincronizzato

    if (correct) {
      markCompleted(currentItem.id);

      // Decrease fail count in SRS
      if (failedTranslations[currentItem.id]) {
        const newFailed = { ...failedTranslations };
        const current = newFailed[currentItem.id];
        const newCount = Math.max(0, (current.count || current) - 1);
        if (newCount === 0) {
          delete newFailed[currentItem.id];
        } else {
          newFailed[currentItem.id] = {
            count: newCount,
            lastFailed: current.lastFailed || Date.now()
          };
        }
        setFailedTranslations(newFailed);
        localStorage.setItem('translation-dojo-failed', JSON.stringify(newFailed));
      }
    } else {
      // Increase fail count in SRS
      const newFailed = { ...failedTranslations };
      const current = newFailed[currentItem.id];
      const currentCount = current?.count || current || 0;
      newFailed[currentItem.id] = {
        count: currentCount + 1,
        lastFailed: Date.now()
      };
      setFailedTranslations(newFailed);
      localStorage.setItem('translation-dojo-failed', JSON.stringify(newFailed));
    }
  };

  const handleNext = () => {
    if (currentIndex < shuffledTranslations.length - 1) {
      // Ferma audio in corso
      window.speechSynthesis.cancel();
      if (audioRef.current) {
        audioRef.current.pause();
      }
      isSpeaking.current = false; // Reset lucchetto
      setAudioPlaying(false);

      setCurrentIndex(prev => prev + 1);
      setUserInput('');
      setShowResult(false);
      setIsCorrect(false);
      setCheckedItem(null);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      // Ferma audio in corso
      window.speechSynthesis.cancel();
      if (audioRef.current) {
        audioRef.current.pause();
      }
      isSpeaking.current = false; // Reset lucchetto
      setAudioPlaying(false);

      setCurrentIndex(prev => prev - 1);
      setUserInput('');
      setShowResult(false);
      setIsCorrect(false);
      setCheckedItem(null);
    }
  };

  const handleReshuffle = () => {
    // Ferma audio in corso
    window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
    }
    isSpeaking.current = false; // Reset lucchetto
    setAudioPlaying(false);

    const weighted = [];
    translationsData.forEach(item => {
      const failData = failedTranslations[item.id];
      const failCount = failData?.count || 0;
      const repetitions = Math.min(failCount + 1, 3);
      for (let i = 0; i < repetitions; i++) {
        weighted.push(item);
      }
    });
    const shuffled = weighted.sort(() => Math.random() - 0.5);

    setShuffledTranslations(shuffled);
    setCurrentIndex(0);
    setUserInput('');
    setShowResult(false);
    setIsCorrect(false);
    setCheckedItem(null);
    resetSession();
  };

  const toggleMode = () => {
    // Ferma audio in corso
    window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
    }
    isSpeaking.current = false; // Reset lucchetto
    setAudioPlaying(false);

    setMode(prev => prev === 'IT_TO_JP' ? 'JP_TO_IT' : 'IT_TO_JP');
    setCurrentIndex(0);
    setUserInput('');
    setShowResult(false);
    setIsCorrect(false);
    setCheckedItem(null);
    resetSession();
  };

  /**
   * Play audio con lucchetto anti-doppia esecuzione
   * SEMPRE usa campo 'reading' (hiragana) per pronuncia corretta
   * Divide il testo in segmenti per forzare pause naturali
   */
  const handlePlayAudio = () => {
    // Lucchetto: impedisce doppia esecuzione durante re-render
    if (isSpeaking.current || audioPlaying) return;

    // SEMPRE cancella tutto prima di iniziare (una sola volta)
    window.speechSynthesis.cancel();

    // Pulisci testo: SOLO hiragana dal campo reading
    const rawText = (currentItem.reading || currentItem.japanese).trim();

    // Segna che stiamo parlando
    isSpeaking.current = true;
    setAudioPlaying(true);

    // Prova file MP3
    const audio = new Audio(`/audio/translations/${currentItem.id}.mp3`);
    audioRef.current = audio;

    const cleanup = () => {
      isSpeaking.current = false;
      setAudioPlaying(false);
    };

    audio.addEventListener('ended', cleanup);

    audio.play().catch(() => {
      // File non trovato: usa Web Speech API con segmentazione
      cleanup();

      // Ricrea il lucchetto per TTS
      isSpeaking.current = true;
      setAudioPlaying(true);

      // Split SEMPLICE su spazi (il database ha già spazi strategici dopo particelle)
      const chunks = rawText.split(' ').filter(s => s.trim().length > 0);

      // Voice Check: cerca voce giapponese (una sola volta)
      const voices = window.speechSynthesis.getVoices();
      const japaneseVoice = voices.find(v => v.lang.startsWith('ja'));

      // Parla i chunks con pause forzate (setTimeout)
      let delay = 0;
      chunks.forEach((chunk, index) => {
        setTimeout(() => {
          const utterance = new SpeechSynthesisUtterance(chunk);
          utterance.lang = 'ja-JP';
          utterance.rate = 0.75; // Velocità moderata
          utterance.pitch = 1.0;
          utterance.volume = 1.0;

          if (japaneseVoice) {
            utterance.voice = japaneseVoice;
          }

          // Cleanup solo sull'ULTIMO chunk
          if (index === chunks.length - 1) {
            utterance.onend = cleanup;
            utterance.onerror = cleanup;
          }

          window.speechSynthesis.speak(utterance);
        }, delay);

        // Pausa di 500ms tra un chunk e l'altro
        delay += (chunk.length * 150) + 500; // Tempo proporzionale alla lunghezza + pausa fissa
      });
    });
  };

  const uniqueCompletedCount = new Set(completedIds).size;
  const progressPercentage = Math.round((uniqueCompletedCount / translationsData.length) * 100);

  // Source e target basati sulla modalità
  const sourceText = mode === 'IT_TO_JP' ? currentItem.italian : currentItem.japanese;
  const targetText = mode === 'IT_TO_JP' ? currentItem.japanese : currentItem.italian;
  const targetReading = currentItem.reading;

  return (
    <div className="min-h-screen bg-washi py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="card-wabi mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-sumi flex items-center gap-3">
              <span className="font-mincho">🥋</span>
              <span>Translation Dojo</span>
            </h1>
            <div className="text-right">
              <div className="text-sm text-gray-500">Progress</div>
              <div className="text-2xl font-bold text-hinomaru">
                {uniqueCompletedCount} / {translationsData.length}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-matcha to-bamboo transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={toggleMode}
                className="btn-accent text-sm px-4 py-2 font-semibold"
              >
                {mode === 'IT_TO_JP' ? '🇮🇹 → 🇯🇵 Produzione' : '🇯🇵 → 🇮🇹 Comprensione'}
              </button>

              <button
                onClick={handleReshuffle}
                className="btn-minimal text-xs px-3 py-1.5"
              >
                🔀 Rimescola
              </button>

              {mode === 'IT_TO_JP' && (
                <button
                  onClick={() => setShowFurigana(!showFurigana)}
                  className={`text-xs px-3 py-1.5 rounded transition-all ${
                    showFurigana ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'btn-minimal'
                  }`}
                >
                  {showFurigana ? '📖 Furigana ON' : '📖 Furigana'}
                </button>
              )}
            </div>

            {/* SRS Badge */}
            {Object.keys(failedTranslations).length > 0 && (
              <div className="bg-orange-100 border border-orange-300 text-orange-700 text-xs px-3 py-1.5 rounded-full font-semibold">
                📌 {Object.keys(failedTranslations).length} in SRS
              </div>
            )}
          </div>
        </div>

        {/* Main Card */}
        <div className="card-wabi relative">
          <div className="text-center mb-6 text-gray-500">
            <span className="text-sm font-medium">
              Frase {currentIndex + 1} / {shuffledTranslations.length}
            </span>
          </div>

          {/* Source Text */}
          <div className="mb-8 p-6 rounded-lg bg-gray-50 border-2 border-gray-200">
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-2">
                {mode === 'IT_TO_JP' ? '🇮🇹 Italiano' : '🇯🇵 Giapponese'}
              </div>
              <div className="text-2xl font-mincho text-sumi">
                {sourceText}
              </div>

              {/* Furigana (solo in modalità JP->IT se richiesto) */}
              {mode === 'JP_TO_IT' && showFurigana && (
                <div className="text-sm text-gray-600 mt-2">
                  {targetReading}
                </div>
              )}
            </div>

            {/* Audio button (solo in modalità JP->IT) */}
            {mode === 'JP_TO_IT' && (
              <div className="text-center mt-4">
                <button
                  onClick={handlePlayAudio}
                  disabled={audioPlaying}
                  className="btn-minimal px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {audioPlaying ? '🔊 Riproduzione...' : '🔊 Ascolta'}
                </button>
              </div>
            )}
          </div>

          {/* Input Field */}
          <div className="mb-4">
            <div className="text-sm text-gray-500 mb-2 text-center">
              {mode === 'IT_TO_JP' ? '✍️ Scrivi in Giapponese' : '✍️ Scrivi in Italiano'}
            </div>

            {mode === 'IT_TO_JP' ? (
              <LiveFeedbackInput
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                target={targetReading}
                placeholder="ここに入力..."
                disabled={showResult}
              />
            ) : (
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                disabled={showResult}
                className="w-full px-6 py-4 rounded-lg text-xl border-2 border-gray-200 focus:border-hinomaru outline-none transition-all"
                placeholder="Scrivi qui..."
                autoFocus
              />
            )}
          </div>

          {/* Check Button */}
          {!showResult && (
            <div className="text-center mb-6">
              <button
                onClick={handleCheck}
                disabled={!userInput.trim()}
                className="btn-accent px-8 py-3 text-lg font-semibold disabled:opacity-30"
              >
                ✓ Verifica
              </button>
            </div>
          )}

          {/* Result Feedback */}
          {showResult && (
            <div className={`mb-6 p-6 rounded-lg border-2 ${
              isCorrect
                ? 'bg-green-50 border-green-300'
                : 'bg-red-50 border-red-300'
            }`}>
              <div className="text-center mb-4">
                <div className={`text-4xl mb-2 ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                  {isCorrect ? '✅ Corretto!' : '❌ Errato'}
                </div>
              </div>

              {!isCorrect && checkedItem && (
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Tua risposta:</div>
                    <div className="text-lg font-mincho text-gray-800">{userInput}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Risposta corretta:</div>
                    <div className="text-lg font-mincho text-sumi font-semibold">
                      {mode === 'IT_TO_JP' ? checkedItem.japanese : checkedItem.italian}
                    </div>
                    {mode === 'IT_TO_JP' && (
                      <div className="text-sm text-gray-600 mt-1">
                        Lettura: {checkedItem.reading}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Audio in modalità IT->JP dopo aver verificato */}
              {mode === 'IT_TO_JP' && (
                <div className="text-center mt-4">
                  <button
                    onClick={handlePlayAudio}
                    disabled={audioPlaying}
                    className="btn-minimal px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {audioPlaying ? '🔊 Riproduzione...' : '🔊 Ascolta pronuncia'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          {showResult && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="btn-minimal py-3 font-semibold disabled:opacity-30"
              >
                ← Precedente
              </button>
              <button
                onClick={handleNext}
                disabled={currentIndex === shuffledTranslations.length - 1}
                className="btn-accent py-3 font-semibold disabled:opacity-30"
              >
                Successivo →
              </button>
            </div>
          )}

          {!showResult && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="btn-minimal py-3 font-semibold disabled:opacity-30"
              >
                ← Precedente
              </button>
              <button
                onClick={handleNext}
                disabled={currentIndex === shuffledTranslations.length - 1}
                className="btn-minimal py-3 font-semibold disabled:opacity-30"
              >
                Salta →
              </button>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 card-wabi">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">ℹ️ Come funziona</h3>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• <strong>IT → JP:</strong> Traduci dall'italiano al giapponese (produzione attiva)</li>
            <li>• <strong>JP → IT:</strong> Traduci dal giapponese all'italiano (comprensione)</li>
            <li>• Puoi scrivere in <strong>Kanji</strong> o <strong>Hiragana</strong>, entrambi sono accettati</li>
            <li>• Puoi omettere il soggetto se grammaticalmente corretto</li>
            <li>• Le frasi sbagliate vengono ripetute automaticamente (SRS)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
