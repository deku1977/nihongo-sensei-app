import React, { useState, useRef, useEffect } from 'react';
import countersData from '../database/counters_n5.json';
import { normalizeKana } from '../utils/kanaUtils';
import useSessionStats from '../hooks/useSessionStats';

/**
 * CounterTemple - Training sui contatori giapponesi N5
 * Sfide interattive con feedback sul PERCHÉ del contatore
 */
export default function CounterTemple() {
  const [currentChallenge, setCurrentChallenge] = useState(null);
  const [userInput, setUserInput] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const { completedIds, completedCount, markCompleted, resetSession } = useSessionStats('counter-temple');
  const isSpeaking = useRef(false);

  /**
   * Genera una sfida random con frasi complete dinamiche e logica di associazione noun-verb
   */
  const generateChallenge = () => {
    // Scegli un contatore random
    const counter = countersData[Math.floor(Math.random() * countersData.length)];

    // Scegli un numero random
    const example = counter.examples[Math.floor(Math.random() * counter.examples.length)];

    // Costruisci prompt italiano e frasi giapponesi dinamicamente
    let prompt = '';
    let sentenceKanji = '';
    let sentenceReading = '';

    if (counter.nouns.length > 0 && counter.verbs.length > 0) {
      // Scegli un sostantivo random
      const noun = counter.nouns[Math.floor(Math.random() * counter.nouns.length)];

      // FILTRA i verbi compatibili con il sostantivo scelto
      const compatibleVerbs = counter.verbs.filter(v =>
        noun.compatibleVerbs && noun.compatibleVerbs.includes(v.verb)
      );

      if (compatibleVerbs.length === 0) {
        console.error(`No compatible verbs for noun ${noun.kanji}`);
        return;
      }

      // Scegli un verbo random tra quelli compatibili
      const verb = compatibleVerbs[Math.floor(Math.random() * compatibleVerbs.length)];

      // COSTRUISCI FRASE DINAMICAMENTE
      sentenceKanji = `${noun.kanji}${verb.particle}${example.kanji}${verb.form}`;
      sentenceReading = `${noun.reading}${verb.particle} ${example.reading} ${verb.reading}`;

      // Costruisci prompt italiano basato su verbo
      if (verb.particle === 'が') {
        if (verb.verb === 'ある' || verb.verb === 'いる') {
          prompt = `Ci sono ${example.number} ${noun.meaning}`;
        } else if (verb.verb === '来る') {
          prompt = `Vengono ${example.number} ${noun.meaning}`;
        }
      } else if (verb.particle === 'を') {
        if (verb.verb === '買う') {
          prompt = `Compro ${example.number} ${noun.meaning}`;
        } else if (verb.verb === '食べる') {
          prompt = `Mangio ${example.number} ${noun.meaning}`;
        } else if (verb.verb === '撮る') {
          prompt = `Scatto ${example.number} ${noun.meaning}`;
        } else if (verb.verb === '飲む') {
          prompt = `Bevo ${example.number} ${noun.meaning}`;
        }
      }
    } else if (counter.category === 'età') {
      // Per età, usa solo il contatore + です
      const verb = counter.verbs[0];
      prompt = `Ho ${example.number} anni`;
      sentenceKanji = `${example.kanji}${verb.form}`;
      sentenceReading = `${example.reading} ${verb.reading}`;
    }

    // Fallback generico (dovrebbe mai accadere)
    if (!prompt) {
      prompt = `Conta ${example.number} oggetti`;
      sentenceKanji = example.kanji;
      sentenceReading = example.reading;
    }

    setCurrentChallenge({
      id: `${counter.id}-${example.number}`,
      prompt,
      counter,
      example,
      correctKanji: sentenceKanji,
      correctReading: sentenceReading,
      explanation: example.explanation,
      counterDescription: counter.description,
      counterUsage: counter.usage
    });
    setUserInput('');
    setShowResult(false);
    setIsCorrect(false);
    setFeedback('');
  };

  useEffect(() => {
    generateChallenge();

    // Precarica voci TTS
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  /**
   * Validazione: accetta sia Kanji che Hiragana (frasi complete)
   * Rimuove spazi e punteggiatura per comparazione flessibile
   */
  const validateAnswer = (input) => {
    if (!currentChallenge) return false;

    // Normalizza input: rimuovi spazi e punteggiatura
    const cleanInput = normalizeKana(input.trim().replace(/\s+/g, '').replace(/[。、！？!?,\.]/g, ''));
    const correctKanji = normalizeKana(currentChallenge.correctKanji.replace(/\s+/g, '').replace(/[。、！？!?,\.]/g, ''));
    const correctReading = normalizeKana(currentChallenge.correctReading.replace(/\s+/g, '').replace(/[。、！？!?,\.]/g, ''));

    return cleanInput === correctKanji || cleanInput === correctReading;
  };

  /**
   * Genera feedback intelligente sul PERCHÉ
   */
  const generateFeedback = () => {
    if (!currentChallenge) return '';

    const { counter, counterUsage, example } = currentChallenge;

    return `Il contatore ${counter.counter} (${counter.reading}) si usa per: ${counterUsage}. ${example.explanation}`;
  };

  const handleCheck = () => {
    const correct = validateAnswer(userInput);
    setIsCorrect(correct);
    setShowResult(true);
    setFeedback(generateFeedback());

    if (correct && currentChallenge) {
      markCompleted(currentChallenge.id);
    }
  };

  const handleNext = () => {
    // Ferma audio in corso
    window.speechSynthesis.cancel();
    isSpeaking.current = false;
    setAudioPlaying(false);

    generateChallenge();
  };

  /**
   * Play audio con chunking (anti-apnea) - rate 0.8
   * SEMPRE usa campo 'reading' (hiragana)
   */
  const handlePlayAudio = () => {
    if (!currentChallenge || isSpeaking.current || audioPlaying) return;

    // SEMPRE cancella tutto prima di iniziare
    window.speechSynthesis.cancel();

    // Usa SOLO hiragana dal campo reading
    const rawText = currentChallenge.correctReading.trim();

    // Segna che stiamo parlando
    isSpeaking.current = true;
    setAudioPlaying(true);

    const cleanup = () => {
      isSpeaking.current = false;
      setAudioPlaying(false);
    };

    // Split su spazi (il reading potrebbe avere spazi strategici)
    const chunks = rawText.split(' ').filter(s => s.trim().length > 0);

    // Voice Check: cerca voce giapponese
    const voices = window.speechSynthesis.getVoices();
    const japaneseVoice = voices.find(v => v.lang.startsWith('ja'));

    // Parla i chunks con pause forzate
    let delay = 0;
    chunks.forEach((chunk, index) => {
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.lang = 'ja-JP';
        utterance.rate = 0.8; // Velocità moderata (come richiesto)
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
      delay += (chunk.length * 150) + 500;
    });
  };

  if (!currentChallenge) {
    return <div className="min-h-screen bg-washi flex items-center justify-center">
      <div className="text-xl text-gray-600">Caricamento...</div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-washi py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="card-wabi mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-sumi flex items-center gap-3">
              <span className="font-mincho">🏯</span>
              <span>Counter Temple</span>
            </h1>
            <div className="text-right">
              <div className="text-sm text-gray-500">Sfide completate</div>
              <div className="text-2xl font-bold text-hinomaru">
                {completedCount}
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowGuide(!showGuide)}
              className={`text-xs px-3 py-1.5 transition-all ${
                showGuide
                  ? 'bg-amber-100 text-amber-700 border border-amber-300 rounded'
                  : 'btn-minimal'
              }`}
            >
              📜 {showGuide ? 'Nascondi Guida' : 'Guida alla Struttura'}
            </button>
            <button
              onClick={resetSession}
              className="btn-minimal text-xs px-3 py-1.5"
            >
              🔄 Reset Sessione
            </button>
          </div>
        </div>

        {/* Guida alla Struttura (Sumi-e style) */}
        {showGuide && (
          <div className="card-wabi mb-6 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 border-4 border-double border-amber-800/30 shadow-lg">
            <h2 className="text-2xl font-bold text-sumi mb-4 font-mincho flex items-center gap-2">
              <span>📜</span>
              <span>Guida alla Struttura</span>
            </h2>

            {/* Schema Formula */}
            <div className="mb-6 p-4 rounded-lg bg-white/70 border-2 border-amber-300 shadow-inner">
              <h3 className="text-sm font-semibold text-amber-900 mb-3 flex items-center gap-2">
                <span>🎯</span>
                <span>Formula della Frase</span>
              </h3>
              <div className="flex items-center justify-center gap-2 text-lg font-mincho flex-wrap">
                <div className="bg-blue-100 px-4 py-2 rounded border-2 border-blue-300 text-blue-900 font-bold">
                  Sostantivo
                </div>
                <span className="text-2xl text-gray-400">+</span>
                <div className="bg-green-100 px-4 py-2 rounded border-2 border-green-300 text-green-900 font-bold">
                  Particella<br/><span className="text-xs">(が / を)</span>
                </div>
                <span className="text-2xl text-gray-400">+</span>
                <div className="bg-purple-100 px-4 py-2 rounded border-2 border-purple-300 text-purple-900 font-bold">
                  Numero + Contatore
                </div>
                <span className="text-2xl text-gray-400">+</span>
                <div className="bg-red-100 px-4 py-2 rounded border-2 border-red-300 text-red-900 font-bold">
                  Verbo
                </div>
              </div>
              <div className="mt-3 text-center text-sm text-gray-600">
                Esempio: <span className="font-mincho text-base text-sumi font-semibold">車が十台あります</span> = Ci sono 10 auto
              </div>
            </div>

            {/* Legenda Particelle */}
            <div className="mb-6 p-4 rounded-lg bg-white/70 border-2 border-green-300 shadow-inner">
              <h3 className="text-sm font-semibold text-green-900 mb-3 flex items-center gap-2">
                <span>📌</span>
                <span>Regole delle Particelle</span>
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-green-700 text-lg">が</span>
                  <div className="flex-1">
                    <span className="font-semibold text-gray-700">Esserci/Venire:</span>
                    <span className="text-gray-600 ml-2">あります (oggetti), います (persone), 来ます</span>
                    <div className="text-xs text-gray-500 mt-1 font-mincho">例: 車<span className="text-green-700 font-bold">が</span>あります (C'è un'auto)</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-blue-700 text-lg">を</span>
                  <div className="flex-1">
                    <span className="font-semibold text-gray-700">Azioni:</span>
                    <span className="text-gray-600 ml-2">買います, 飲みます, 食べます, 撮ります</span>
                    <div className="text-xs text-gray-500 mt-1 font-mincho">例: 水<span className="text-blue-700 font-bold">を</span>飲みます (Bevo acqua)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabella Fonetica 〜本 */}
            <div className="mb-6 p-4 rounded-lg bg-white/70 border-2 border-purple-300 shadow-inner">
              <h3 className="text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
                <span>🎵</span>
                <span>Irregolarità Fonetiche: 〜本 (ほん) - Oggetti Lunghi</span>
              </h3>
              <div className="grid grid-cols-5 gap-2 text-xs">
                <div className="bg-red-50 p-2 rounded border border-red-200 text-center">
                  <div className="font-bold text-red-700">1</div>
                  <div className="font-mincho text-sm">いっぽん</div>
                  <div className="text-gray-500">ippon</div>
                </div>
                <div className="bg-red-50 p-2 rounded border border-red-200 text-center">
                  <div className="font-bold text-red-700">3</div>
                  <div className="font-mincho text-sm">さんぼん</div>
                  <div className="text-gray-500">sanbon</div>
                </div>
                <div className="bg-red-50 p-2 rounded border border-red-200 text-center">
                  <div className="font-bold text-red-700">6</div>
                  <div className="font-mincho text-sm">ろっぽん</div>
                  <div className="text-gray-500">roppon</div>
                </div>
                <div className="bg-red-50 p-2 rounded border border-red-200 text-center">
                  <div className="font-bold text-red-700">8</div>
                  <div className="font-mincho text-sm">はっぽん</div>
                  <div className="text-gray-500">happon</div>
                </div>
                <div className="bg-red-50 p-2 rounded border border-red-200 text-center">
                  <div className="font-bold text-red-700">10</div>
                  <div className="font-mincho text-sm">じゅっぽん</div>
                  <div className="text-gray-500">juppon</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-600 text-center">
                💡 Nota: Le consonanti cambiano (h → p, h → b) per facilitare la pronuncia
              </div>
            </div>

            {/* Tabella Fonetica 〜人 */}
            <div className="mb-6 p-4 rounded-lg bg-white/70 border-2 border-blue-300 shadow-inner">
              <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <span>👥</span>
                <span>Irregolarità Fonetiche: 〜人 (にん) - Persone</span>
              </h3>
              <div className="grid grid-cols-4 gap-2 text-xs mb-3">
                <div className="bg-yellow-50 p-2 rounded border-2 border-yellow-400 text-center">
                  <div className="font-bold text-yellow-700">1</div>
                  <div className="font-mincho text-sm">ひとり</div>
                  <div className="text-gray-500">hitori</div>
                  <div className="text-xs text-red-600 font-bold mt-1">⭐ UNICO</div>
                </div>
                <div className="bg-yellow-50 p-2 rounded border-2 border-yellow-400 text-center">
                  <div className="font-bold text-yellow-700">2</div>
                  <div className="font-mincho text-sm">ふたり</div>
                  <div className="text-gray-500">futari</div>
                  <div className="text-xs text-red-600 font-bold mt-1">⭐ UNICO</div>
                </div>
                <div className="bg-blue-50 p-2 rounded border border-blue-200 text-center">
                  <div className="font-bold text-blue-700">4</div>
                  <div className="font-mincho text-sm">よにん</div>
                  <div className="text-gray-500">yonin</div>
                </div>
                <div className="bg-blue-50 p-2 rounded border border-blue-200 text-center">
                  <div className="font-bold text-blue-700">7</div>
                  <div className="font-mincho text-sm">しちにん</div>
                  <div className="text-gray-500">shichinin</div>
                </div>
              </div>
              <div className="text-xs text-gray-600 text-center">
                ⚠️ <strong>IMPORTANTE:</strong> ひとり e ふたり sono forme completamente uniche! Dal 3 in poi segue il pattern regolare (さんにん, ごにん, etc.)
              </div>
            </div>

            {/* Tabella Fonetica 〜歳 */}
            <div className="p-4 rounded-lg bg-white/70 border-2 border-pink-300 shadow-inner">
              <h3 className="text-sm font-semibold text-pink-900 mb-3 flex items-center gap-2">
                <span>🎂</span>
                <span>Irregolarità Fonetiche: 〜歳 (さい) - Età</span>
              </h3>
              <div className="grid grid-cols-4 gap-2 text-xs mb-3">
                <div className="bg-pink-50 p-2 rounded border border-pink-200 text-center">
                  <div className="font-bold text-pink-700">1</div>
                  <div className="font-mincho text-sm">いっさい</div>
                  <div className="text-gray-500">issai</div>
                </div>
                <div className="bg-pink-50 p-2 rounded border border-pink-200 text-center">
                  <div className="font-bold text-pink-700">8</div>
                  <div className="font-mincho text-sm">はっさい</div>
                  <div className="text-gray-500">hassai</div>
                </div>
                <div className="bg-pink-50 p-2 rounded border border-pink-200 text-center">
                  <div className="font-bold text-pink-700">10</div>
                  <div className="font-mincho text-sm">じゅっさい</div>
                  <div className="text-gray-500">jussai</div>
                </div>
                <div className="bg-red-50 p-2 rounded border-2 border-red-400 text-center">
                  <div className="font-bold text-red-700">20</div>
                  <div className="font-mincho text-sm">はたち</div>
                  <div className="text-gray-500">hatachi</div>
                  <div className="text-xs text-red-600 font-bold mt-1">⭐ SPECIALE</div>
                </div>
              </div>
              <div className="text-xs text-gray-600 text-center">
                💡 Nota: はたち (20 anni) è una forma speciale che indica la maggiore età in Giappone
              </div>
            </div>
          </div>
        )}

        {/* Challenge Card */}
        <div className="card-wabi">
          {/* Prompt */}
          <div className="mb-8 p-6 rounded-lg bg-gradient-to-br from-matcha/10 to-bamboo/10 border-2 border-matcha/20">
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-2">📝 Sfida</div>
              <div className="text-3xl font-bold text-sumi mb-4">
                {currentChallenge.prompt}
              </div>
              <div className="text-sm text-gray-500">
                Scrivi la frase completa in Giapponese (Kanji o Hiragana)
              </div>
            </div>
          </div>

          {/* Input Field */}
          <div className="mb-4">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              disabled={showResult}
              className="w-full px-6 py-4 rounded-lg text-2xl text-center border-2 border-gray-200 focus:border-hinomaru outline-none transition-all font-mincho"
              placeholder="ここに入力..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !showResult && userInput.trim()) {
                  handleCheck();
                }
              }}
            />
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

              {!isCorrect && (
                <div className="space-y-3 mb-4">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Tua risposta:</div>
                    <div className="text-xl font-mincho text-gray-800">{userInput}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Risposta corretta:</div>
                    <div className="text-2xl font-mincho text-sumi font-semibold">
                      {currentChallenge.correctKanji}
                    </div>
                    <div className="text-lg text-gray-600 mt-1">
                      Lettura: {currentChallenge.correctReading}
                    </div>
                  </div>
                </div>
              )}

              {/* Feedback intelligente */}
              <div className="bg-white/50 p-4 rounded-lg border border-gray-200 mb-4">
                <div className="text-sm font-semibold text-gray-700 mb-2">
                  💡 Perché?
                </div>
                <div className="text-sm text-gray-700 leading-relaxed">
                  {feedback}
                </div>
              </div>

              {/* Tabella Irregolarità del Contatore (solo se sbagliato) */}
              {!isCorrect && currentChallenge && currentChallenge.counter.examples.some(ex => ex.explanation.includes('Irregolare')) && (
                <div className="bg-amber-50/70 p-4 rounded-lg border-2 border-amber-300">
                  <div className="text-sm font-semibold text-amber-900 mb-3 flex items-center gap-2">
                    <span>📋</span>
                    <span>Tabella Irregolarità: {currentChallenge.counter.counter} ({currentChallenge.counter.reading})</span>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-2 text-xs">
                    {currentChallenge.counter.examples
                      .filter(ex => ex.explanation.includes('Irregolare'))
                      .map(ex => (
                        <div key={ex.number} className="bg-white p-2 rounded border-2 border-amber-200 text-center">
                          <div className="font-bold text-amber-800">{ex.number}</div>
                          <div className="font-mincho text-sm text-sumi">{ex.reading}</div>
                          <div className="text-gray-500">{ex.romaji}</div>
                        </div>
                      ))
                    }
                  </div>
                  <div className="mt-2 text-xs text-gray-600 text-center">
                    ⚠️ Attenzione alle irregolarità fonetiche di questo contatore!
                  </div>
                </div>
              )}

              {/* Audio */}
              <div className="text-center mt-4">
                <button
                  onClick={handlePlayAudio}
                  disabled={audioPlaying}
                  className="btn-minimal px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {audioPlaying ? '🔊 Riproduzione...' : '🔊 Ascolta pronuncia'}
                </button>
              </div>
            </div>
          )}

          {/* Next Button */}
          {showResult && (
            <div className="text-center">
              <button
                onClick={handleNext}
                className="btn-accent px-8 py-3 text-lg font-semibold"
              >
                Prossima Sfida →
              </button>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 card-wabi">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">📚 Contatori N5</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {countersData.map(counter => (
              <div key={counter.id} className="bg-gray-50 p-3 rounded border border-gray-200">
                <div className="font-bold text-sumi mb-1">
                  {counter.counter} ({counter.reading})
                </div>
                <div className="text-gray-600">
                  {counter.description}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 card-wabi">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">ℹ️ Come funziona</h3>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• Leggi il prompt italiano e scrivi la <strong>frase completa</strong> in giapponese</li>
            <li>• Include: <strong>sostantivo + particella (が/を) + contatore + verbo</strong></li>
            <li>• Esempio: "Ci sono 10 auto" → 車が十台あります o くるまがじゅうだいあります</li>
            <li>• Puoi scrivere in <strong>Kanji</strong> o <strong>Hiragana</strong> (entrambi accettati)</li>
            <li>• Presta attenzione alle <strong>irregolarità fonetiche</strong> (es: いっぽん, さんぼん, ひとり)</li>
            <li>• Il feedback spiega il PERCHÉ di ogni contatore</li>
            <li>• L'audio legge la frase completa con pause naturali</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
