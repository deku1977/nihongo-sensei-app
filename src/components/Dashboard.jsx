import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useSessionStats from '../hooks/useSessionStats';
import useJLPTLevels from '../hooks/useJLPTLevels';
import useGlobalProgress from '../hooks/useGlobalProgress';
import sentencesData from '../database/sentences.json';
import kanjiMaster from '../database/kanji_master.json';

/**
 * Dashboard - Hub di Apprendimento (Wabi-Sabi)
 * Global Progress, Activity Streak, Quick-Start Cards
 */
export default function Dashboard() {
  const { streak } = useSessionStats();
  const { selectedLevels } = useJLPTLevels();
  const globalProgress = useGlobalProgress();
  const navigate = useNavigate();
  const [dailyKanji, setDailyKanji] = useState(null);
  const [totalXP, setTotalXP] = useState(0);
  const [recentlyMastered, setRecentlyMastered] = useState([]);

  /**
   * Carica XP totale e Diario del Guerriero da localStorage
   */
  useEffect(() => {
    const loadData = () => {
      const xp = parseInt(localStorage.getItem('nihongo_sensei_xp') || '0', 10);
      setTotalXP(xp);

      const journal = JSON.parse(localStorage.getItem('recentlyMastered') || '[]');
      setRecentlyMastered(journal);
    };

    loadData();

    // Ricarica dati quando la finestra torna in focus
    window.addEventListener('focus', loadData);
    return () => window.removeEventListener('focus', loadData);
  }, []);

  /**
   * Carica Kanji del Giorno filtrato per livelli selezionati
   */
  useEffect(() => {
    const STORAGE_KEY = 'nihongo_daily_kanji';
    const now = Date.now();
    const stored = localStorage.getItem(STORAGE_KEY);

    // Combina tutti i kanji dei livelli selezionati
    const availableKanji = selectedLevels.flatMap(level => kanjiMaster[level] || []);

    if (availableKanji.length === 0) {
      setDailyKanji(null);
      return;
    }

    let kanjiToShow = null;

    if (stored) {
      const { kanji, timestamp, levels } = JSON.parse(stored);
      const elapsed = now - timestamp;
      const twentyFourHours = 24 * 60 * 60 * 1000;

      // Verifica se livelli sono cambiati o sono passate 24 ore
      const levelsChanged = JSON.stringify(levels) !== JSON.stringify(selectedLevels);

      if (elapsed < twentyFourHours && !levelsChanged && availableKanji.find(k => k.kanji === kanji.kanji)) {
        kanjiToShow = kanji;
      }
    }

    // Seleziona nuovo kanji casuale
    if (!kanjiToShow) {
      const randomIndex = Math.floor(Math.random() * availableKanji.length);
      kanjiToShow = availableKanji[randomIndex];

      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        kanji: kanjiToShow,
        timestamp: now,
        levels: selectedLevels
      }));
    }

    setDailyKanji(kanjiToShow);
  }, [selectedLevels]);

  const modules = [
    {
      path: '/dictation',
      icon: '🎧',
      title: 'Dictation Master',
      description: 'Ascolta e trascrivi frasi in hiragana',
      color: 'from-matcha to-bamboo'
    },
    {
      path: '/flashcards',
      icon: '🃏',
      title: 'Flashcards',
      description: 'Sistema SRS per la memorizzazione',
      color: 'from-hinomaru to-pink-500'
    },
    {
      path: '/verbs',
      icon: '📝',
      title: 'Verb Lab',
      description: 'Coniugazioni dinamiche e pratica',
      color: 'from-blue-500 to-indigo-600'
    },
    {
      path: '/translation',
      icon: '🥋',
      title: 'Translation Dojo',
      description: 'Traduzione attiva IT↔JP (N5 Masu)',
      color: 'from-teal-500 to-cyan-600'
    },
    {
      path: '/counters',
      icon: '🏯',
      title: 'Counter Temple',
      description: 'Contatori giapponesi N5 con irregolarità',
      color: 'from-indigo-500 to-purple-600'
    },
    {
      path: '/writing',
      icon: '✍️',
      title: 'Kaki Board',
      description: 'Scrittura kanji con stroke order',
      color: 'from-purple-500 to-pink-600'
    },
    {
      path: '/kanji',
      icon: '📖',
      title: 'Kanji Widget',
      description: 'Kanji del giorno con etimologia',
      color: 'from-amber-500 to-orange-600'
    },
    {
      path: '/dungeon',
      icon: '⚔️',
      title: 'Battle Dungeon',
      description: 'Ondate di nemici + Boss Battle con dettato',
      color: 'from-red-600 to-orange-700'
    }
  ];

  return (
    <div className="min-h-screen bg-washi py-12 px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center relative">
          <Link
            to="/settings"
            className="absolute right-0 top-0 bg-gradient-to-r from-matcha to-bamboo text-white px-4 py-2 rounded-lg hover:shadow-md transition-all text-sm font-bold"
          >
            ⚙️ Impostazioni
          </Link>
          <h1 className="text-5xl font-bold text-sumi mb-3 font-mincho flex items-center justify-center gap-4">
            <span>日本語先生</span>
          </h1>
          <p className="text-lg text-gray-500">Wabi-Sabi Modern Learning Platform</p>
        </div>

        {/* Global Progress Card */}
        <div className="card-wabi mb-8 bg-gradient-to-br from-white to-gray-50">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-sumi mb-1">Your Global Progress</h2>
              <p className="text-gray-500">
                {selectedLevels.length > 0
                  ? `Livelli: ${selectedLevels.join(', ')}`
                  : 'Seleziona livelli JLPT in Settings'}
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-hinomaru mb-1">
                {globalProgress.percentage}%
              </div>
              <div className="text-sm text-gray-500">
                {globalProgress.completed} / {globalProgress.total} completati
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-matcha to-bamboo transition-all duration-700"
              style={{ width: `${globalProgress.percentage}%` }}
            />
          </div>

          {/* Breakdown dettagliato */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="text-xs text-blue-600 font-semibold mb-1">漢字 Kanji</div>
              <div className="text-lg font-bold text-blue-700">
                {globalProgress.breakdown.kanji.completed} / {globalProgress.breakdown.kanji.total}
              </div>
              <div className="text-xs text-gray-500">
                {globalProgress.breakdown.kanji.total > 0
                  ? Math.round((globalProgress.breakdown.kanji.completed / globalProgress.breakdown.kanji.total) * 100)
                  : 0}%
              </div>
            </div>

            <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
              <div className="text-xs text-purple-600 font-semibold mb-1">動詞 Verbi</div>
              <div className="text-lg font-bold text-purple-700">
                {globalProgress.breakdown.verbs.completed} / {globalProgress.breakdown.verbs.total}
              </div>
              <div className="text-xs text-gray-500">
                {globalProgress.breakdown.verbs.total > 0
                  ? Math.round((globalProgress.breakdown.verbs.completed / globalProgress.breakdown.verbs.total) * 100)
                  : 0}%
              </div>
            </div>

            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <div className="text-xs text-green-600 font-semibold mb-1">📝 Frasi</div>
              <div className="text-lg font-bold text-green-700">
                {globalProgress.breakdown.sentences.completed} / {globalProgress.breakdown.sentences.total}
              </div>
              <div className="text-xs text-gray-500">
                {globalProgress.breakdown.sentences.total > 0
                  ? Math.round((globalProgress.breakdown.sentences.completed / globalProgress.breakdown.sentences.total) * 100)
                  : 0}%
              </div>
            </div>

            <div className="bg-red-50 p-3 rounded-lg border border-red-200">
              <div className="text-xs text-red-600 font-semibold mb-1">⚔️ Dungeon</div>
              <div className="text-lg font-bold text-red-700">
                {globalProgress.breakdown.dungeons.completed} / {globalProgress.breakdown.dungeons.total}
              </div>
              <div className="text-xs text-gray-500">
                {globalProgress.breakdown.dungeons.total > 0
                  ? Math.round((globalProgress.breakdown.dungeons.completed / globalProgress.breakdown.dungeons.total) * 100)
                  : 0}%
              </div>
            </div>
          </div>

          {/* Streak & XP */}
          <div className="flex items-center gap-4 justify-center mt-6">
            <div className="flex items-center gap-2 p-4 bg-white rounded-lg flex-1">
              <span className="text-3xl">🔥</span>
              <div>
                <div className="text-2xl font-bold text-hinomaru">{streak}</div>
                <div className="text-sm text-gray-500">Current Streak</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-4 bg-white rounded-lg flex-1">
              <span className="text-3xl">⚔️</span>
              <div>
                <div className="text-2xl font-bold text-amber-600">{totalXP}</div>
                <div className="text-sm text-gray-500">Total XP</div>
              </div>
            </div>
          </div>
        </div>

        {/* Messaggio se nessun livello selezionato */}
        {selectedLevels.length === 0 && (
          <div className="card-wabi mb-8 bg-amber-50 border-2 border-amber-200">
            <div className="flex gap-3 items-start">
              <span className="text-4xl">⚙️</span>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-amber-900 mb-2">Nessun livello JLPT selezionato</h3>
                <p className="text-sm text-amber-800 mb-3">
                  Per iniziare a studiare, seleziona i livelli JLPT nelle impostazioni.
                </p>
                <Link
                  to="/settings"
                  className="inline-block bg-gradient-to-r from-matcha to-bamboo text-white px-4 py-2 rounded-lg hover:shadow-md transition-all text-sm font-bold"
                >
                  Vai alle Impostazioni
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Kanji del Giorno Widget */}
        {dailyKanji && (
          <div className="card-wabi mb-8 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-sumi font-mincho">今日の漢字</h2>
              <span className="text-sm text-gray-500">Kanji del Giorno</span>
            </div>

            <div className="flex items-center gap-6">
              {/* Kanji Display */}
              <div className="flex-shrink-0 bg-white rounded-lg p-6 shadow-sm relative">
                <div className="text-7xl font-bold text-sumi font-mincho text-center">
                  {dailyKanji.kanji}
                </div>
                {/* Audio Icon */}
                {(() => {
                  const hex = dailyKanji.kanji.codePointAt(0).toString(16).padStart(5, '0');
                  const audioPath = `/audio/kanji/${hex}.mp3`;
                  return (
                    <button
                      onClick={() => {
                        const audio = new Audio(audioPath);
                        audio.play().catch(() => console.log('Audio not available'));
                      }}
                      className="absolute top-2 right-2 bg-matcha/20 hover:bg-matcha/40 text-matcha p-2 rounded-full transition-colors"
                      title="Ascolta pronuncia"
                    >
                      🔊
                    </button>
                  );
                })()}
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="text-lg font-bold text-sumi mb-2">{dailyKanji.meaning}</div>
                <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                  <div>
                    <span className="text-gray-500">音:</span> {dailyKanji.onyomi}
                  </div>
                  <div>
                    <span className="text-gray-500">訓:</span> {dailyKanji.kunyomi || '—'}
                  </div>
                </div>
                <button
                  onClick={() => navigate('/writing', { state: { selectedKanji: dailyKanji.kanji } })}
                  className="bg-gradient-to-r from-matcha to-bamboo text-white px-4 py-2 rounded-lg hover:shadow-md transition-all text-sm font-bold"
                >
                  ✍️ Esercitati
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Diario del Guerriero (Recent Mastery) */}
        {recentlyMastered.length > 0 && (
          <div className="card-wabi mb-8 bg-gradient-to-br from-stone-50 to-stone-100 border-2 border-stone-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-sumi font-mincho flex items-center gap-2">
                <span>📖</span>
                <span>戦士の日記</span>
              </h2>
              <span className="text-sm text-gray-500">Diario del Guerriero</span>
            </div>

            <p className="text-sm text-gray-600 mb-4">Ultimi nemici sconfitti nella Battle Dungeon:</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {recentlyMastered.slice(0, 5).map((entry, index) => (
                <div
                  key={entry.timestamp}
                  className="bg-white p-4 rounded-lg shadow-sm border-2 border-stone-200 hover:border-matcha transition-all"
                >
                  {/* Badge tipo nemico */}
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      entry.type === 'boss'
                        ? 'bg-red-100 text-red-700'
                        : entry.type === 'kanji'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {entry.type === 'boss' ? '👹 Boss' : entry.type === 'kanji' ? '漢字' : '動詞'}
                    </span>
                    <span className="text-xs text-gray-400">#{index + 1}</span>
                  </div>

                  {/* Contenuto */}
                  <div className="text-center mb-2">
                    <div className={`font-bold text-sumi mb-1 ${
                      entry.type === 'boss' ? 'text-lg' : 'text-3xl'
                    }`}>
                      {entry.content}
                    </div>
                    <div className="text-sm text-blue-600 mb-1">{entry.reading}</div>
                    <div className="text-xs text-gray-500 line-clamp-2">{entry.meaning}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Module Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map(module => (
            <Link
              key={module.path}
              to={module.path}
              className="card-wabi hover:shadow-hanko transition-all transform hover:scale-105 group"
            >
              <div className={`text-6xl mb-4 bg-gradient-to-br ${module.color} bg-clip-text text-transparent`}>
                {module.icon}
              </div>
              <h3 className="text-xl font-bold text-sumi mb-2 group-hover:text-hinomaru transition-colors">
                {module.title}
              </h3>
              <p className="text-gray-500 text-sm">
                {module.description}
              </p>
            </Link>
          ))}
        </div>

        {/* Footer Quote (Wabi-Sabi spirit) */}
        <div className="mt-12 text-center">
          <p className="text-gray-400 italic text-sm font-mincho">
            "七転び八起き" - Nana korobi ya oki
          </p>
          <p className="text-gray-500 text-xs mt-1">
            Fall seven times, stand up eight
          </p>
        </div>
      </div>
    </div>
  );
}
