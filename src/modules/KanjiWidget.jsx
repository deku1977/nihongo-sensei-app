import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import kanjiData from '../database/kanji_n5.json';

/**
 * KanjiWidget - Kanji del Giorno
 * Seleziona un kanji casuale ogni 24 ore e permette di esercitarsi direttamente
 */
export default function KanjiWidget() {
  const navigate = useNavigate();
  const [dailyKanji, setDailyKanji] = useState(null);

  /**
   * Seleziona kanji del giorno (24h cache localStorage)
   */
  useEffect(() => {
    const STORAGE_KEY = 'nihongo_daily_kanji';
    const now = Date.now();
    const stored = localStorage.getItem(STORAGE_KEY);

    let kanjiToShow = null;

    if (stored) {
      const { kanji, timestamp } = JSON.parse(stored);
      const elapsed = now - timestamp;
      const twentyFourHours = 24 * 60 * 60 * 1000;

      // Se sono passate meno di 24 ore, usa il kanji salvato
      if (elapsed < twentyFourHours) {
        kanjiToShow = kanji;
      }
    }

    // Altrimenti seleziona un nuovo kanji casuale
    if (!kanjiToShow) {
      const randomIndex = Math.floor(Math.random() * kanjiData.length);
      kanjiToShow = kanjiData[randomIndex];

      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        kanji: kanjiToShow,
        timestamp: now
      }));
    }

    setDailyKanji(kanjiToShow);
  }, []);

  /**
   * Naviga a KakiBoard con kanji pre-selezionato
   */
  const handlePractice = () => {
    if (dailyKanji) {
      navigate('/writing', { state: { selectedKanji: dailyKanji.kanji } });
    }
  };

  if (!dailyKanji) {
    return (
      <div className="min-h-screen bg-washi py-12 px-4 flex items-center justify-center">
        <div className="text-sumi text-xl">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-washi py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-sumi mb-2 font-mincho">今日の漢字</h1>
          <p className="text-gray-500">Kanji del Giorno</p>
        </div>

        {/* Card Principale */}
        <div className="card-wabi bg-gradient-to-br from-white to-gray-50">
          {/* Kanji Grande (Stile Calligrafico) */}
          <div className="text-center mb-8 py-8 bg-white rounded-lg shadow-inner">
            <div className="text-9xl font-bold text-sumi font-mincho mb-4">
              {dailyKanji.kanji}
            </div>
            <div className="text-2xl text-gray-600 italic">
              {dailyKanji.meaning}
            </div>
          </div>

          {/* Letture On-yomi e Kun-yomi */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gradient-to-br from-matcha/10 to-bamboo/10 p-4 rounded-lg border border-matcha/20">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">On-yomi (音読み)</div>
              <div className="text-xl font-bold text-sumi">{dailyKanji.onyomi}</div>
            </div>
            <div className="bg-gradient-to-br from-hinomaru/10 to-pink-100/50 p-4 rounded-lg border border-hinomaru/20">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Kun-yomi (訓読み)</div>
              <div className="text-xl font-bold text-sumi">{dailyKanji.kunyomi || '—'}</div>
            </div>
          </div>

          {/* Numero Tratti */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6 text-center">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Tratti</div>
            <div className="text-3xl font-bold text-sumi">{dailyKanji.strokes}</div>
          </div>

          {/* Esempi */}
          <div className="mb-6">
            <h3 className="text-sm text-gray-500 uppercase tracking-wider mb-3">Esempi di Utilizzo</h3>
            <div className="space-y-3">
              {dailyKanji.examples.map((example, idx) => (
                <div key={idx} className="bg-white p-4 rounded-lg border border-gray-100 hover:border-matcha/30 transition-colors">
                  <div className="flex items-baseline gap-3">
                    <div className="text-2xl font-bold text-sumi font-mincho">{example.word}</div>
                    <div className="text-sm text-gray-500">{example.reading}</div>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{example.meaning}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottone Esercitati */}
          <button
            onClick={handlePractice}
            className="w-full bg-gradient-to-r from-matcha to-bamboo text-white font-bold py-4 px-6 rounded-lg hover:shadow-hanko transition-all transform hover:scale-105 text-lg"
          >
            ✍️ Esercitati con questo Kanji
          </button>
        </div>

        {/* Note Wabi-Sabi */}
        <div className="mt-8 text-center">
          <p className="text-gray-400 italic text-sm font-mincho">
            "千里の道も一歩から" - Senri no michi mo ippo kara
          </p>
          <p className="text-gray-500 text-xs mt-1">
            Anche un viaggio di mille miglia inizia con un singolo passo
          </p>
        </div>
      </div>
    </div>
  );
}
