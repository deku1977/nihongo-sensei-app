import React, { useState, useEffect } from 'react';
import sentencesData from '../database/sentences.json';
import kanjiMaster from '../database/kanji_master.json';
import useJLPTLevels from '../hooks/useJLPTLevels';
import useDailyCardsTarget from '../hooks/useDailyCardsTarget';
import FlipCard from '../components/FlipCard';
import {
  buildFlashcardQueue,
  updateMasteryLevel,
  getMasteryData,
  getMasteryLabel,
  getMasteryColor
} from '../utils/flashcardQueue';

/**
 * FlashCards - Sistema SRS Evoluto
 *
 * Priorità:
 * 1. Frasi fallite/Near-Miss dal Dictation (Critical)
 * 2. Frasi N5 mai viste (Base Deck - prime 20)
 * 3. Frasi completate ma non ripassate da >3 giorni
 */
export default function FlashCards() {
  const { selectedLevels } = useJLPTLevels();
  const { dailyTarget } = useDailyCardsTarget();
  const [flashcardQueue, setFlashcardQueue] = useState([]);
  const [queueStats, setQueueStats] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewedToday, setReviewedToday] = useState(new Set());
  const [showStats, setShowStats] = useState(true);
  const [studyMode, setStudyMode] = useState('mix'); // 'mix', 'kanji-only', 'errors-only'

  // Combina kanji dai livelli selezionati
  const availableKanji = selectedLevels.flatMap(level => kanjiMaster[level] || []);

  // Genera label dinamica livelli (es. "N5, N4" o "Attivi")
  const levelsLabel = selectedLevels.length > 0
    ? selectedLevels.join(', ')
    : 'Nessun livello';

  // Build queue on mount and when localStorage changes
  useEffect(() => {
    rebuildQueue();
  }, []);

  const rebuildQueue = (mode = studyMode) => {
    const failedData = localStorage.getItem('dictation-failed-sentences');
    const failedSentences = failedData ? JSON.parse(failedData) : {};

    const { queue, stats } = buildFlashcardQueue(sentencesData, failedSentences, availableKanji, mode, dailyTarget);
    setFlashcardQueue(queue);
    setQueueStats(stats);
    setCurrentIndex(0);
  };

  // Rebuild queue quando cambia study mode, livelli selezionati, o daily target
  useEffect(() => {
    rebuildQueue(studyMode);
  }, [studyMode, selectedLevels.join(','), dailyTarget]);

  // Load reviewed today from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('flashcards-reviewed-today');
    if (stored) {
      setReviewedToday(new Set(JSON.parse(stored)));
    }
  }, []);

  const currentCard = flashcardQueue[currentIndex];

  // Keyboard shortcuts (Anki-style)
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (reviewedToday.has(currentCard?.id)) return;

      // Anki shortcuts: 1, 2, 3, 4
      if (e.key === '1') {
        handleAnkiAgain();
      } else if (e.key === '2') {
        handleAnkiHard();
      } else if (e.key === '3' || e.key === 'Enter') {
        handleAnkiGood();
      } else if (e.key === '4') {
        handleAnkiEasy();
      }
      // Navigation
      else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        handlePrev();
      } else if (e.key === 'ArrowRight' && currentIndex < flashcardQueue.length - 1) {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex, flashcardQueue.length, currentCard, reviewedToday]);

  const handleNext = () => {
    if (currentIndex < flashcardQueue.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  // Helper: Advance to next card
  const advanceCard = () => {
    if (currentIndex < flashcardQueue.length - 1) {
      setTimeout(() => handleNext(), 300);
    } else {
      // Queue completed → rebuild
      setTimeout(() => rebuildQueue(), 500);
    }
  };

  // Helper: Track reviewed
  const trackReviewed = () => {
    if (!currentCard) return;
    const newReviewed = new Set(reviewedToday);
    newReviewed.add(currentCard.id);
    setReviewedToday(newReviewed);
    sessionStorage.setItem('flashcards-reviewed-today', JSON.stringify([...newReviewed]));
  };

  // Helper: Remove from critical SRS
  const removeFromCritical = () => {
    if (!currentCard || currentCard.priority !== 1) return;
    const stored = localStorage.getItem('dictation-failed-sentences');
    if (stored) {
      const failedData = JSON.parse(stored);
      if (failedData[currentCard.id]) {
        delete failedData[currentCard.id];
        localStorage.setItem('dictation-failed-sentences', JSON.stringify(failedData));
      }
    }
  };

  // Anki-Style Buttons

  /**
   * ANCORA - Reset completo, aggiungi a critical
   * Mastery: 0
   */
  const handleAnkiAgain = () => {
    if (!currentCard) return;
    updateMasteryLevel(currentCard.id, 0);

    // Add to critical (failed sentences)
    const stored = localStorage.getItem('dictation-failed-sentences');
    const failedData = stored ? JSON.parse(stored) : {};
    const current = failedData[currentCard.id] || {};
    failedData[currentCard.id] = {
      count: (current.count || 0) + 1,
      lastFailed: Date.now()
    };
    localStorage.setItem('dictation-failed-sentences', JSON.stringify(failedData));

    trackReviewed();
    advanceCard();
  };

  /**
   * DIFFICILE - Vista ma da ripassare presto
   * Mastery: 1
   */
  const handleAnkiHard = () => {
    if (!currentCard) return;
    updateMasteryLevel(currentCard.id, 1);
    trackReviewed();
    advanceCard();
  };

  /**
   * BENE - Standard review
   * Mastery: 2
   */
  const handleAnkiGood = () => {
    if (!currentCard) return;
    updateMasteryLevel(currentCard.id, 2);
    removeFromCritical();
    trackReviewed();
    advanceCard();
  };

  /**
   * FACILE - Masterizzata
   * Mastery: 3
   */
  const handleAnkiEasy = () => {
    if (!currentCard) return;
    updateMasteryLevel(currentCard.id, 3);
    removeFromCritical();
    trackReviewed();
    advanceCard();
  };

  const handleResetSession = () => {
    sessionStorage.removeItem('flashcards-reviewed-today');
    setReviewedToday(new Set());
    setCurrentIndex(0);
  };

  const handleResetAllProgress = () => {
    if (confirm('⚠️ Questo resetterà tutto il progresso FlashCards. Sicuro?')) {
      localStorage.removeItem('flashcards-mastery-levels');
      sessionStorage.removeItem('flashcards-reviewed-today');
      setReviewedToday(new Set());
      rebuildQueue();
    }
  };

  // Empty state: no cards
  if (flashcardQueue.length === 0) {
    const emptyMessages = {
      'kanji-only': {
        icon: '🈯',
        title: `Tutti i Kanji ${levelsLabel} completati!`,
        message: 'Hai studiato tutti i kanji disponibili'
      },
      'errors-only': {
        icon: '✨',
        title: 'Nessun errore da recuperare!',
        message: 'Non hai frasi critiche dal Dictation Master. Ottimo lavoro!'
      },
      'mix': {
        icon: '🎉',
        title: 'Deck Completato!',
        message: 'Hai completato tutte le carte disponibili'
      }
    };

    const currentMessage = emptyMessages[studyMode] || emptyMessages['mix'];

    return (
      <div className="min-h-screen bg-washi py-12 px-4 flex items-center justify-center">
        <div className="card-wabi max-w-md text-center">
          <div className="text-6xl mb-6">{currentMessage.icon}</div>
          <h1 className="text-3xl font-bold text-sumi mb-4">{currentMessage.title}</h1>
          <p className="text-gray-500 mb-6">{currentMessage.message}</p>

          {studyMode === 'errors-only' && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
              <p className="text-sm text-gray-600 mb-2">
                💡 Prova a cambiare modalità per studiare altre carte
              </p>
            </div>
          )}

          <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4">
            <p className="text-sm text-gray-600 mb-2">
              ✅ <strong>Frasi</strong>: {queueStats.n5Completed || 0} / {queueStats.n5Total || 150}
            </p>
            <p className="text-sm text-gray-600">
              🈯 <strong>Kanji {levelsLabel}</strong>: {queueStats.n5KanjiCompleted || 0} / {queueStats.n5KanjiTotal || 0}
            </p>
          </div>

          <div className="space-y-2">
            {studyMode !== 'mix' && (
              <button
                onClick={() => setStudyMode('mix')}
                className="btn-accent w-full"
              >
                🔀 Passa a Mix Totale
              </button>
            )}
            <button
              onClick={() => rebuildQueue(studyMode)}
              className="btn-minimal w-full"
            >
              🔄 Ricarica Queue
            </button>
            <button
              onClick={handleResetAllProgress}
              className="btn-minimal w-full text-sm"
            >
              ⚠️ Reset tutto progresso
            </button>
          </div>
        </div>
      </div>
    );
  }

  const progressPercentage = Math.round((reviewedToday.size / flashcardQueue.length) * 100);
  const masteryData = currentCard ? getMasteryData(currentCard.id) : null;

  // Priority badge
  const getPriorityBadge = (priority, reason) => {
    const badges = {
      1: { label: '🔥 Critical', color: 'bg-red-100 text-red-700 border-red-300' },
      2: { label: '✨ Nuova', color: 'bg-blue-100 text-blue-700 border-blue-300' },
      3: { label: '🔄 Ripasso', color: 'bg-amber-100 text-amber-700 border-amber-300' }
    };
    const badge = badges[priority] || badges[2];
    return (
      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-washi py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header with Stats Toggle */}
        <div className="card-wabi mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-sumi flex items-center gap-3">
                <span>🃏</span>
                <span>FlashCards SRS</span>
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Sistema di Ripasso Intelligente con Priorità
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Carta</div>
              <div className="text-2xl font-bold text-hinomaru">
                {currentIndex + 1} / {flashcardQueue.length}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-r from-matcha to-bamboo transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 text-right mb-4">
            {reviewedToday.size} / {flashcardQueue.length} ripassate oggi
          </div>

          {/* Study Mode Selector */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setStudyMode('mix')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                studyMode === 'mix'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              🔀 Mix Totale
            </button>
            <button
              onClick={() => setStudyMode('kanji-only')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                studyMode === 'kanji-only'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              🈯 Solo Kanji
            </button>
            <button
              onClick={() => setStudyMode('errors-only')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                studyMode === 'errors-only'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              🔥 Solo Errori
            </button>
          </div>

          {/* Progresso - Dinamico per mode */}
          {studyMode === 'mix' && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* Frasi */}
              <div className="p-3 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200">
                <div className="text-xs font-semibold text-blue-900 mb-1">📚 Frasi</div>
                <div className="text-2xl font-bold text-blue-700 mb-1">
                  {queueStats.n5Completed || 0} / {queueStats.n5Total || 150}
                </div>
                <div className="w-full bg-blue-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-500"
                    style={{ width: `${(queueStats.n5Completed / queueStats.n5Total) * 100}%` }}
                  />
                </div>
              </div>

              {/* Kanji Attivi */}
              <div className="p-3 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200">
                <div className="text-xs font-semibold text-purple-900 mb-1">🈯 Kanji {levelsLabel}</div>
                <div className="text-2xl font-bold text-purple-700 mb-1">
                  {queueStats.n5KanjiCompleted || 0} / {queueStats.n5KanjiTotal || 0}
                </div>
                <div className="w-full bg-purple-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-purple-600 transition-all duration-500"
                    style={{ width: `${queueStats.n5KanjiTotal > 0 ? (queueStats.n5KanjiCompleted / queueStats.n5KanjiTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {studyMode === 'kanji-only' && (
            <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-purple-900">🈯 Kanji {levelsLabel} - Studio Dedicato</span>
                <span className="text-xs text-purple-600">
                  {queueStats.n5KanjiTotal > 0 ? Math.round((queueStats.n5KanjiCompleted / queueStats.n5KanjiTotal) * 100) : 0}% completato
                </span>
              </div>
              <div className="text-3xl font-bold text-purple-700 mb-2">
                {queueStats.n5KanjiCompleted || 0} / {queueStats.n5KanjiTotal || 0}
              </div>
              <div className="w-full bg-purple-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-purple-600 transition-all duration-500"
                  style={{ width: `${queueStats.n5KanjiTotal > 0 ? (queueStats.n5KanjiCompleted / queueStats.n5KanjiTotal) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {studyMode === 'errors-only' && (
            <div className="p-4 rounded-lg bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 mb-3">
              <div className="text-sm font-semibold text-red-900 mb-2">🔥 Recupero Errori Dictation</div>
              <div className="text-3xl font-bold text-red-700 mb-2">
                {queueStats.critical || 0} frasi critiche
              </div>
              <div className="text-xs text-red-600">
                Frasi fallite o con punteggio &lt; 100% dal Dictation Master
              </div>
            </div>
          )}

          {/* Mix Giornaliero */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-center">
              <div className="text-2xl font-bold text-red-600">{queueStats.critical || 0}</div>
              <div className="text-xs text-red-500 mt-1">🔥 Critiche</div>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-center">
              <div className="text-2xl font-bold text-blue-600">{queueStats.newN5 || 0}</div>
              <div className="text-xs text-blue-500 mt-1">✨ Nuove</div>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-center">
              <div className="text-2xl font-bold text-amber-600">{queueStats.reviewNeeded || 0}</div>
              <div className="text-xs text-amber-500 mt-1">🔄 Ripasso</div>
            </div>
          </div>

          <button
            onClick={() => setShowStats(!showStats)}
            className="w-full mt-3 text-xs text-gray-500 hover:text-gray-700"
          >
            {showStats ? '▼' : '▶'} {showStats ? 'Nascondi' : 'Mostra'} dettagli
          </button>

          {/* Detailed Stats */}
          {showStats && (
            <div className="mt-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-gray-500">🔥 P1: Critical</div>
                  <div className="font-bold text-red-700">{queueStats.critical || 0}</div>
                </div>
                <div>
                  <div className="text-gray-500">✨ P2: Nuove</div>
                  <div className="font-bold text-blue-700">{queueStats.newN5 || 0}</div>
                </div>
                <div>
                  <div className="text-gray-500">🔄 P3: Ripasso</div>
                  <div className="font-bold text-amber-700">{queueStats.reviewNeeded || 0}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Current Card Info */}
        {currentCard && (
          <div className="card-wabi mb-4 bg-gradient-to-br from-white to-gray-50">
            <div className="flex items-center justify-between mb-3">
              {getPriorityBadge(currentCard.priority, currentCard.reason)}
              {masteryData && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold border"
                  style={{
                    backgroundColor: `${getMasteryColor(masteryData.level)}20`,
                    borderColor: getMasteryColor(masteryData.level),
                    color: getMasteryColor(masteryData.level)
                  }}
                >
                  {getMasteryLabel(masteryData.level)}
                  {masteryData.reviewCount > 0 && ` (${masteryData.reviewCount}x)`}
                </span>
              )}
            </div>
          </div>
        )}

        {/* FlipCard */}
        {currentCard && (
          <div className="mb-6">
            <FlipCard sentence={currentCard} />
          </div>
        )}

        {/* Anki-Style Feedback Buttons */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <button
            onClick={handleAnkiAgain}
            disabled={reviewedToday.has(currentCard?.id)}
            className="py-4 rounded-lg font-semibold text-white transition-all disabled:opacity-30 hover:shadow-lg"
            style={{ backgroundColor: '#BC002D' }}
            title="Non la ricordo, mostrala di nuovo"
          >
            <div className="text-sm">Non la so</div>
            <div className="text-xs opacity-80 mt-1">&lt;1 min</div>
          </button>
          <button
            onClick={handleAnkiHard}
            disabled={reviewedToday.has(currentCard?.id)}
            className="py-4 rounded-lg font-semibold text-white transition-all disabled:opacity-30 hover:shadow-lg"
            style={{ backgroundColor: '#E9B824' }}
            title="Difficile, ma ci sono arrivato"
          >
            <div className="text-sm">Con sforzo</div>
            <div className="text-xs opacity-80 mt-1">&lt;10 min</div>
          </button>
          <button
            onClick={handleAnkiGood}
            disabled={reviewedToday.has(currentCard?.id)}
            className="py-4 rounded-lg font-semibold text-white transition-all disabled:opacity-30 hover:shadow-lg"
            style={{ backgroundColor: '#6B8E23' }}
            title="L'ho saputa bene"
          >
            <div className="text-sm">Bene!</div>
            <div className="text-xs opacity-80 mt-1">3 giorni</div>
          </button>
          <button
            onClick={handleAnkiEasy}
            disabled={reviewedToday.has(currentCard?.id)}
            className="py-4 rounded-lg font-semibold text-white transition-all disabled:opacity-30 hover:shadow-lg"
            style={{ backgroundColor: '#87A96B' }}
            title="La so benissimo, è troppo facile"
          >
            <div className="text-sm">La so bene</div>
            <div className="text-xs opacity-80 mt-1">7 giorni</div>
          </button>
        </div>

        {/* Navigation */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="btn-minimal disabled:opacity-30"
          >
            ← Precedente
          </button>
          <button
            onClick={() => setCurrentIndex(0)}
            className="btn-minimal"
          >
            🔄 Ricomincia
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex === flashcardQueue.length - 1}
            className="btn-minimal disabled:opacity-30"
          >
            Successiva →
          </button>
        </div>

        {/* Settings Card */}
        <div className="card-wabi bg-gradient-to-br from-white to-gray-50">
          <h3 className="text-lg font-bold text-sumi mb-4">⚙️ Impostazioni</h3>

          <div className="space-y-2 mb-4">
            <button
              onClick={handleResetSession}
              className="w-full btn-minimal text-sm py-2"
            >
              🔄 Reset sessione (mantieni progresso)
            </button>
            <button
              onClick={rebuildQueue}
              className="w-full btn-minimal text-sm py-2"
            >
              🔃 Ricarica queue da localStorage
            </button>
            <button
              onClick={handleResetAllProgress}
              className="w-full btn-minimal text-sm py-2 text-red-600 hover:bg-red-50"
            >
              ⚠️ Reset TUTTO progresso
            </button>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 mb-3">
            <p className="text-xs text-gray-600 font-semibold mb-2">⌨️ Scorciatoie tastiera:</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>1: Non la so</div>
              <div>2: Con sforzo</div>
              <div>3 o Enter: Bene!</div>
              <div>4: La so bene</div>
              <div>← Precedente</div>
              <div>→ Successiva</div>
            </div>
          </div>

          {/* Info */}
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <p className="text-xs text-gray-600 mb-2">
              💡 <strong>Sistema Doppia Sorgente:</strong>
            </p>
            <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
              <li><strong>Sorgente 1 (Curriculum):</strong> 150 frasi in ordine sequenziale</li>
              <li><strong>Sorgente 2 (Kanji {levelsLabel}):</strong> {queueStats.n5KanjiTotal || 0} kanji dai livelli attivi</li>
              <li><strong>Sorgente 3 (Recupero Dictation):</strong> Errori dal Dictation Master</li>
              <li><strong>Mix Giornaliero:</strong> Critiche + Nuove frasi + Kanji attivi</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
