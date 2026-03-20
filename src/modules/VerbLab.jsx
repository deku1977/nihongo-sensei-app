import React, { useState, useEffect, useRef } from 'react';
import { generateConjugationQuiz, conjugateVerb, getAcceptableForms } from '../utils/nihongoEngine';

/**
 * Confronta due stringhe carattere per carattere
 * @param {string} userAnswer - Risposta utente
 * @param {string} correctAnswer - Risposta corretta
 * @returns {Array} - Array di {char, status: 'correct'|'wrong'|'extra'|'missing'}
 */
function compareStrings(userAnswer, correctAnswer) {
  const maxLen = Math.max(userAnswer.length, correctAnswer.length);
  const result = [];

  for (let i = 0; i < maxLen; i++) {
    const userChar = userAnswer[i] || '';
    const correctChar = correctAnswer[i] || '';

    if (!userChar && correctChar) {
      result.push({ char: correctChar, status: 'missing', position: i });
    } else if (userChar && !correctChar) {
      result.push({ char: userChar, status: 'extra', position: i });
    } else if (userChar === correctChar) {
      result.push({ char: userChar, status: 'correct', position: i });
    } else {
      result.push({
        char: userChar,
        correctChar: correctChar,
        status: 'wrong',
        position: i
      });
    }
  }

  return result;
}

/**
 * VerbLab - Ripasso interattivo coniugazioni verbi
 * Input e verifica in HIRAGANA (non kanji)
 * Feedback dettagliato con Stop & Wait
 */
export default function VerbLab() {
  const [quiz, setQuiz] = useState([]);
  const [quizSize, setQuizSize] = useState(null); // null = schermata iniziale
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState(null); // 'correct' | 'wrong' | null
  const [charComparison, setCharComparison] = useState(null);
  const [stats, setStats] = useState({ correct: 0, wrong: 0 });
  const [showHint, setShowHint] = useState(false);
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [canProceed, setCanProceed] = useState(false);
  const [usedAlternative, setUsedAlternative] = useState(null); // Forma alternativa usata
  const inputRef = useRef(null);

  const startQuiz = (size) => {
    setQuizSize(size);
    const newQuiz = generateConjugationQuiz(size);
    setQuiz(newQuiz);
    setCurrentIndex(0);
    setStats({ correct: 0, wrong: 0 });
    setFeedback(null);
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentIndex]);

  const handleSubmit = (e) => {
    e.preventDefault();

    // Se già verificato, passa alla prossima domanda (doppio invio)
    if (canProceed) {
      handleNext();
      return;
    }

    // Prima verifica
    if (!userInput.trim()) return;

    const currentQuestion = quiz[currentIndex];
    const userAnswer = userInput.trim();

    // Ottieni tutte le forme accettabili
    const conjugated = conjugateVerb(currentQuestion.reading, currentQuestion.type);
    const acceptableForms = getAcceptableForms(conjugated, currentQuestion.requestedForm);

    // Verifica se la risposta è corretta (primary o alternative)
    const isCorrect = acceptableForms.allAcceptable.includes(userAnswer);
    const isPrimary = userAnswer === acceptableForms.primary;
    const alternativeUsed = !isPrimary && isCorrect ? userAnswer : null;

    // Confronto carattere per carattere (usa primary come riferimento)
    const comparison = compareStrings(userAnswer, acceptableForms.primary);

    // Salva verbo completato se corretto
    if (isCorrect) {
      const completedVerbs = JSON.parse(localStorage.getItem('completed_verbs') || '[]');
      if (!completedVerbs.includes(currentQuestion.reading)) {
        completedVerbs.push(currentQuestion.reading);
        localStorage.setItem('completed_verbs', JSON.stringify(completedVerbs));
      }
    }

    setFeedback(isCorrect ? 'correct' : 'wrong');
    setCharComparison(comparison);
    setCanProceed(true);
    setUsedAlternative(alternativeUsed);
    setStats(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      wrong: prev.wrong + (isCorrect ? 0 : 1)
    }));
  };

  const handleNext = () => {
    if (currentIndex < quiz.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setUserInput('');
      setFeedback(null);
      setCharComparison(null);
      setShowHint(false);
      setCanProceed(false);
      setUsedAlternative(null);
    } else {
      // Quiz completato
      setFeedback('completed');
    }
  };

  const handleSkip = () => {
    setStats(prev => ({ ...prev, wrong: prev.wrong + 1 }));
    handleNext();
  };

  const resetQuiz = () => {
    setQuizSize(null); // Torna alla schermata di selezione
    setQuiz([]);
    setCurrentIndex(0);
    setUserInput('');
    setFeedback(null);
    setCharComparison(null);
    setStats({ correct: 0, wrong: 0 });
    setShowHint(false);
    setShowCheatSheet(false);
    setCanProceed(false);
    setUsedAlternative(null);
  };

  // Schermata iniziale: selezione numero domande
  if (quizSize === null) {
    return (
      <div className="min-h-screen bg-washi py-12 px-4 flex items-center justify-center">
        <div className="card-wabi max-w-2xl">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">📝</div>
            <h1 className="text-4xl font-bold text-sumi mb-3">Verb Lab 動詞</h1>
            <p className="text-gray-600">
              Scegli quanti verbi vuoi esercitare
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Database: 68 verbi (N5/N4)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => startQuiz(10)}
              className="p-6 bg-gradient-to-br from-matcha/10 to-bamboo/10 hover:from-matcha/20 hover:to-bamboo/20 border-2 border-matcha/30 rounded-xl transition-all group"
            >
              <div className="text-4xl font-bold text-matcha mb-2">10</div>
              <div className="text-sm text-gray-600">Veloce</div>
            </button>

            <button
              onClick={() => startQuiz(20)}
              className="p-6 bg-gradient-to-br from-blue-100 to-indigo-100 hover:from-blue-200 hover:to-indigo-200 border-2 border-blue-300 rounded-xl transition-all group"
            >
              <div className="text-4xl font-bold text-blue-600 mb-2">20</div>
              <div className="text-sm text-gray-600">Medio</div>
            </button>

            <button
              onClick={() => startQuiz(30)}
              className="p-6 bg-gradient-to-br from-orange-100 to-red-100 hover:from-orange-200 hover:to-red-200 border-2 border-orange-300 rounded-xl transition-all group"
            >
              <div className="text-4xl font-bold text-orange-600 mb-2">30</div>
              <div className="text-sm text-gray-600">Intenso</div>
            </button>

            <button
              onClick={() => startQuiz(68)}
              className="p-6 bg-gradient-to-br from-hinomaru/10 to-pink-100 hover:from-hinomaru/20 hover:to-pink-200 border-2 border-hinomaru/40 rounded-xl transition-all group"
            >
              <div className="text-4xl font-bold text-hinomaru mb-2">68</div>
              <div className="text-sm text-gray-600">Tutti i verbi!</div>
            </button>
          </div>

          <div className="bg-bamboo/10 p-4 rounded-lg border border-bamboo/30">
            <div className="text-sm text-gray-700 space-y-1">
              <div className="font-semibold text-bamboo mb-2">ℹ️ Come funziona:</div>
              <div>• Scrivi le risposte in <strong>HIRAGANA</strong></div>
              <div>• Forme richieste: <strong>-MASU</strong>, <strong>-TE</strong>, <strong>Passato</strong></div>
              <div>• Usa la tabella regole come aiuto</div>
              <div>• Feedback dettagliato carattere per carattere</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (quiz.length === 0) {
    return (
      <div className="min-h-screen bg-washi flex items-center justify-center">
        <div className="text-sumi text-xl">Caricamento...</div>
      </div>
    );
  }

  if (feedback === 'completed') {
    const percentage = Math.round((stats.correct / (stats.correct + stats.wrong)) * 100);
    return (
      <div className="min-h-screen bg-washi py-12 px-4 flex items-center justify-center">
        <div className="card-wabi max-w-lg text-center">
          <div className="text-6xl mb-6">🎉</div>
          <h2 className="text-3xl font-bold text-sumi mb-4">Quiz Completato!</h2>
          <div className="text-sm text-gray-500 mb-4">
            {quizSize} domande completate
          </div>
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-matcha/10 p-4 rounded-lg border border-matcha/30">
              <div className="text-3xl font-bold text-matcha">{stats.correct}</div>
              <div className="text-sm text-gray-600">Corrette</div>
            </div>
            <div className="bg-hinomaru/10 p-4 rounded-lg border border-hinomaru/30">
              <div className="text-3xl font-bold text-hinomaru">{stats.wrong}</div>
              <div className="text-sm text-gray-600">Sbagliate</div>
            </div>
          </div>
          <div className="text-2xl font-bold text-sumi mb-6">
            Punteggio: {percentage}%
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => startQuiz(quizSize)}
              className="flex-1 px-6 py-3 bg-matcha text-white rounded-lg hover:bg-matcha/90 transition-all shadow-washi font-semibold"
            >
              🔄 Stesso numero ({quizSize})
            </button>
            <button
              onClick={resetQuiz}
              className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-semibold"
            >
              ⚙️ Cambia numero
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = quiz[currentIndex];
  const formLabel = {
    'polite.present': 'Forma -MASU (presente cortese)',
    'te': 'Forma -TE',
    'past.aff': 'Passato affermativo'
  }[currentQuestion.requestedForm] || currentQuestion.requestedForm;

  return (
    <div className="min-h-screen bg-washi py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header con Stats */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-sumi mb-2">Verb Lab 動詞</h1>
            <p className="text-gray-500">
              Domanda {currentIndex + 1} / {quiz.length}
            </p>
          </div>
          <div className="flex gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-matcha">{stats.correct}</div>
              <div className="text-xs text-gray-500">Corrette</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-hinomaru">{stats.wrong}</div>
              <div className="text-xs text-gray-500">Sbagliate</div>
            </div>
          </div>
        </div>

        {/* Cheat Sheet Toggle */}
        <div className="mb-6">
          <button
            onClick={() => setShowCheatSheet(!showCheatSheet)}
            className="w-full px-4 py-2 bg-bamboo/10 text-bamboo font-semibold rounded-lg hover:bg-bamboo/20 transition-all border border-bamboo/30 flex items-center justify-between"
          >
            <span>📚 Tabella Regole di Coniugazione</span>
            <span className="text-xl">{showCheatSheet ? '▼' : '▶'}</span>
          </button>

          {showCheatSheet && (
            <div className="mt-3 p-5 bg-white rounded-lg border border-gray-200 shadow-washi">
              <div className="space-y-4 text-sm">
                {/* Ichidan */}
                <div className="border-l-4 border-matcha pl-4">
                  <h3 className="font-bold text-matcha mb-2">一段 ICHIDAN (Gruppo 1)</h3>
                  <div className="space-y-1 text-gray-700">
                    <div>Verbi che finiscono in <strong>-eru</strong> o <strong>-iru</strong></div>
                    <div className="bg-matcha/5 p-2 rounded mt-2 space-y-1">
                      <div><strong>Forma -MASU:</strong> 食べる → 食べ<span className="text-matcha font-bold">ます</span> (tabe<strong className="text-matcha">masu</strong>)</div>
                      <div><strong>Forma -TE:</strong> 食べる → 食べ<span className="text-matcha font-bold">て</span> (tabe<strong className="text-matcha">te</strong>)</div>
                      <div><strong>Passato:</strong> 食べる → 食べ<span className="text-matcha font-bold">た</span> (tabe<strong className="text-matcha">ta</strong>)</div>
                      <div className="text-xs text-gray-500 pt-1">Rimuovi る, aggiungi desinenza</div>
                    </div>
                  </div>
                </div>

                {/* Godan */}
                <div className="border-l-4 border-blue-500 pl-4">
                  <h3 className="font-bold text-blue-600 mb-2">五段 GODAN (Gruppo 2)</h3>
                  <div className="space-y-1 text-gray-700">
                    <div>Verbi con terminazioni varie (う、く、ぐ、す、つ、ぬ、ぶ、む、る)</div>
                    <div className="bg-blue-50 p-2 rounded mt-2 space-y-1">
                      <div><strong>Forma -MASU:</strong> 書く → 書き<span className="text-blue-600 font-bold">ます</span> (kaki<strong className="text-blue-600">masu</strong>)</div>
                      <div><strong>Forma -TE:</strong></div>
                      <div className="text-xs ml-4 space-y-0.5">
                        <div>• う、つ、る → って (買う → 買<strong className="text-blue-600">って</strong>)</div>
                        <div>• む、ぬ、ぶ → んで (飲む → 飲<strong className="text-blue-600">んで</strong>)</div>
                        <div>• く → いて (書く → 書<strong className="text-blue-600">いて</strong>)</div>
                        <div>• ぐ → いで (泳ぐ → 泳<strong className="text-blue-600">いで</strong>)</div>
                        <div>• す → して (話す → 話<strong className="text-blue-600">して</strong>)</div>
                      </div>
                      <div className="text-xs text-gray-500 pt-1">Cambia ultima sillaba secondo tabella</div>
                    </div>
                  </div>
                </div>

                {/* Irregular */}
                <div className="border-l-4 border-hinomaru pl-4">
                  <h3 className="font-bold text-hinomaru mb-2">不規則 IRREGULAR (Gruppo 3)</h3>
                  <div className="space-y-1 text-gray-700">
                    <div className="bg-hinomaru/5 p-2 rounded space-y-1">
                      <div><strong>する:</strong> します、して、した</div>
                      <div><strong>来る (くる):</strong> きます、きて、きた</div>
                      <div className="text-xs text-gray-500 pt-1">Forme fisse da memorizzare</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-8 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-matcha to-bamboo transition-all duration-500"
            style={{ width: `${((currentIndex + 1) / quiz.length) * 100}%` }}
          />
        </div>

        {/* Question Card */}
        <div className={`card-wabi transition-all duration-300 ${
          feedback === 'correct' ? 'ring-4 ring-matcha/50 bg-matcha/5' :
          feedback === 'wrong' ? 'ring-4 ring-hinomaru/50 bg-hinomaru/5' :
          ''
        }`}>
          {/* Verb Info */}
          <div className="text-center mb-8">
            <div className="text-6xl font-bold text-sumi mb-4">
              {currentQuestion.verb}
            </div>
            <div className="text-xl text-gray-600 mb-2">
              {currentQuestion.reading}
            </div>
            <div className="text-lg text-gray-500">
              {currentQuestion.meaning}
            </div>
            <div className="mt-4 inline-block px-4 py-2 bg-kintsugi/20 rounded-full border border-kintsugi/40">
              <span className="text-sm font-semibold text-sumi">
                {currentQuestion.type === 'godan' ? '五段 Godan' :
                 currentQuestion.type === 'ichidan' ? '一段 Ichidan' :
                 '不規則 Irregular'}
              </span>
            </div>
          </div>

          {/* Form Request */}
          <div className="text-center mb-6">
            <div className="text-sm text-gray-500 mb-2">Coniuga in:</div>
            <div className="text-xl font-semibold text-matcha mb-2">
              {formLabel}
            </div>
            <div className="inline-block px-3 py-1 bg-bamboo/10 rounded-full border border-bamboo/30">
              <span className="text-xs text-bamboo font-semibold">
                ⚠️ Scrivi in HIRAGANA (es. たべます non 食べます)
              </span>
            </div>
          </div>

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                disabled={canProceed}
                placeholder="Scrivi in hiragana (es. たべます)..."
                className={`w-full px-6 py-4 text-2xl text-center rounded-lg border-2 transition-all
                  ${feedback === 'correct' ? 'border-matcha bg-matcha/10 text-matcha' :
                    feedback === 'wrong' ? 'border-hinomaru bg-hinomaru/10 text-hinomaru' :
                    'border-gray-300 focus:border-matcha focus:ring-2 focus:ring-matcha/20'
                  } disabled:opacity-75 outline-none`}
              />
              {feedback === 'correct' && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-3xl">✓</div>
              )}
              {feedback === 'wrong' && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-3xl">✗</div>
              )}
            </div>

            {/* Feedback Message con confronto dettagliato */}
            {feedback === 'correct' && (
              <div className="text-center space-y-3">
                <div className="text-2xl font-semibold text-matcha">
                  ✓ 正解！Perfetto!
                </div>
                {usedAlternative ? (
                  <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-lg">
                    <div className="text-lg font-semibold text-blue-700 mb-2">
                      📚 Hai usato una forma alternativa valida!
                    </div>
                    <div className="text-sm text-gray-700 space-y-1">
                      <div>✓ Tua risposta: <strong className="text-blue-600">{usedAlternative}</strong></div>
                      <div>✓ Forma alternativa: <strong className="text-blue-600">{quiz[currentIndex].answer}</strong></div>
                      <div className="text-xs text-gray-500 mt-2">
                        (Entrambe le forme sono corrette - piana e cortese)
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-lg text-gray-600">
                    La tua risposta è corretta!
                  </div>
                )}
              </div>
            )}

            {feedback === 'wrong' && charComparison && (
              <div className="space-y-4">
                <div className="text-center text-xl font-semibold text-hinomaru">
                  ✗ 間違い Sbagliato
                </div>

                {/* Confronto visivo carattere per carattere */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  {/* Tua risposta */}
                  <div>
                    <div className="text-xs text-gray-500 mb-2">La tua risposta:</div>
                    <div className="flex flex-wrap gap-1 text-2xl font-bold justify-center">
                      {charComparison.map((item, idx) => {
                        if (item.status === 'missing') return null;
                        return (
                          <span
                            key={idx}
                            className={`px-2 py-1 rounded ${
                              item.status === 'correct'
                                ? 'bg-matcha/20 text-matcha'
                                : item.status === 'wrong'
                                ? 'bg-hinomaru/20 text-hinomaru line-through'
                                : 'bg-orange-100 text-orange-600'
                            }`}
                          >
                            {item.char}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Risposta corretta */}
                  <div>
                    <div className="text-xs text-gray-500 mb-2">Risposta corretta:</div>
                    <div className="flex flex-wrap gap-1 text-2xl font-bold justify-center">
                      {currentQuestion.answer.split('').map((char, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 rounded bg-matcha/20 text-matcha"
                        >
                          {char}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Legenda differenze */}
                  {charComparison.some(item => item.status !== 'correct') && (
                    <div className="text-xs text-gray-500 text-center pt-2 border-t">
                      <span className="text-matcha">● Corretto</span>
                      <span className="mx-2">|</span>
                      <span className="text-hinomaru">● Sbagliato</span>
                      {charComparison.some(item => item.status === 'extra') && (
                        <>
                          <span className="mx-2">|</span>
                          <span className="text-orange-600">● Extra</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              {!canProceed && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowHint(!showHint)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all text-sm"
                  >
                    {showHint ? '🙈 Nascondi' : '💡 Suggerimento'}
                  </button>
                  <button
                    type="submit"
                    disabled={!userInput.trim()}
                    className="flex-1 px-6 py-3 bg-matcha text-white rounded-lg hover:bg-matcha/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold shadow-washi"
                  >
                    Verifica
                  </button>
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all text-sm"
                  >
                    Salta →
                  </button>
                </>
              )}

              {canProceed && (
                <button
                  type="submit"
                  className="w-full px-6 py-4 bg-gradient-to-r from-matcha to-bamboo text-white rounded-lg hover:opacity-90 transition-all font-bold text-lg shadow-lg"
                >
                  Prossimo Verbo → (o premi Invio)
                </button>
              )}
            </div>
          </form>

          {/* Hint (solo prima della verifica) */}
          {showHint && !canProceed && (
            <div className="mt-4 p-4 bg-bamboo/10 rounded-lg border border-bamboo/30 text-sm text-gray-700">
              <div className="font-semibold mb-2">💡 Suggerimento:</div>
              {currentQuestion.requestedForm === 'polite.present' && (
                <div>
                  Parti da <strong>{currentQuestion.reading}</strong>, rimuovi る e aggiungi <strong>ます</strong>
                </div>
              )}
              {currentQuestion.requestedForm === 'te' && (
                <div>
                  {currentQuestion.type === 'ichidan' && `Parti da ${currentQuestion.reading}, rimuovi る e aggiungi て`}
                  {currentQuestion.type === 'godan' && 'Cambia ultima sillaba secondo le regole TE-form (consulta tabella)'}
                  {currentQuestion.type === 'irregular' && `Verbo irregolare - usa la forma fissa`}
                </div>
              )}
              {currentQuestion.requestedForm === 'past.aff' && (
                <div>Simile alla forma TE, ma sostituisci て/で con た/だ</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
