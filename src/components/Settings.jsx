import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useJLPTLevels from '../hooks/useJLPTLevels';
import useDailyCardsTarget from '../hooks/useDailyCardsTarget';
import kanjiMaster from '../database/kanji_master.json';

/**
 * Settings - Gestione Livelli JLPT
 * Permette di selezionare quali livelli JLPT includere nello studio
 */
export default function Settings() {
  const { selectedLevels, toggleLevel } = useJLPTLevels();
  const { dailyTarget, setDailyTarget } = useDailyCardsTarget();
  const navigate = useNavigate();
  const [kanjiCounts, setKanjiCounts] = useState({});
  const [svgCounts, setSvgCounts] = useState({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Calcola conteggi kanji da kanji_master.json e SVG presenti
  useEffect(() => {
    const counts = {
      N5: kanjiMaster.N5?.length || 0,
      N4: kanjiMaster.N4?.length || 0,
      N3: kanjiMaster.N3?.length || 0,
      N2: kanjiMaster.N2?.length || 0,
      N1: kanjiMaster.N1?.length || 0
    };
    setKanjiCounts(counts);

    // Conta SVG presenti verificando se esistono in public/kanji/
    const countSVGs = async () => {
      const svgCounts = {};

      for (const [level, kanjiList] of Object.entries(kanjiMaster)) {
        if (!kanjiList || kanjiList.length === 0) {
          svgCounts[level] = 0;
          continue;
        }

        let presentCount = 0;
        for (const kanjiObj of kanjiList) {
          const hex = kanjiObj.kanji.codePointAt(0).toString(16).padStart(5, '0');
          const svgPath = `/kanji/${hex}.svg`;

          // Verifica esistenza tramite fetch HEAD
          try {
            const response = await fetch(svgPath, { method: 'HEAD' });
            if (response.ok) presentCount++;
          } catch (e) {
            // SVG non esiste
          }
        }
        svgCounts[level] = presentCount;
      }

      setSvgCounts(svgCounts);
    };

    countSVGs();
  }, []);

  const levels = [
    { code: 'N5', name: 'N5 - Beginner', description: 'Livello base', expectedKanji: 80, color: 'from-green-500 to-emerald-600' },
    { code: 'N4', name: 'N4 - Elementary', description: 'Livello elementare', expectedKanji: 170, color: 'from-blue-500 to-cyan-600' },
    { code: 'N3', name: 'N3 - Intermediate', description: 'Livello intermedio', expectedKanji: 370, color: 'from-purple-500 to-violet-600' },
    { code: 'N2', name: 'N2 - Pre-Advanced', description: 'Livello pre-avanzato', expectedKanji: 415, color: 'from-orange-500 to-amber-600' },
    { code: 'N1', name: 'N1 - Advanced', description: 'Livello avanzato', expectedKanji: 1165, color: 'from-red-500 to-rose-600' }
  ];

  return (
    <div className="min-h-screen bg-washi py-12 px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-sumi mb-2 font-mincho">Impostazioni</h1>
          <p className="text-gray-500">Configura il tuo percorso di studio</p>
        </div>

        {/* Livelli JLPT Card */}
        <div className="card-wabi">
          <h2 className="text-2xl font-bold text-sumi mb-4">Livelli JLPT Attivi</h2>
          <p className="text-gray-600 mb-6">
            Seleziona i livelli JLPT che vuoi includere nel tuo studio.
            Questa selezione filtra i contenuti in tutti i moduli (Kanji del Giorno, Flashcards, KakiBoard).
          </p>

          {/* Level Toggles */}
          <div className="space-y-4">
            {levels.map(level => {
              const isSelected = selectedLevels.includes(level.code);
              const totalKanji = kanjiCounts[level.code] || 0;
              const svgPresent = svgCounts[level.code] || 0;
              const isEmpty = totalKanji === 0;
              const percentage = totalKanji > 0 ? Math.round((svgPresent / totalKanji) * 100) : 0;

              return (
                <div key={level.code}>
                  <div
                    className={`
                      border-2 rounded-lg p-5 cursor-pointer transition-all
                      ${isSelected
                        ? 'border-matcha bg-gradient-to-br from-matcha/5 to-bamboo/5 shadow-md'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                      }
                      ${isEmpty ? 'opacity-60' : ''}
                    `}
                    onClick={() => toggleLevel(level.code)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        {/* Checkbox */}
                        <div className={`
                          w-6 h-6 rounded border-2 flex items-center justify-center transition-all flex-shrink-0
                          ${isSelected
                            ? 'bg-matcha border-matcha'
                            : 'border-gray-300 bg-white'
                          }
                        `}>
                          {isSelected && (
                            <svg className="w-4 h-4 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                              <path d="M5 13l4 4L19 7"></path>
                            </svg>
                          )}
                        </div>

                        {/* Level Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <div className={`font-bold text-lg bg-gradient-to-r ${level.color} bg-clip-text text-transparent`}>
                              {level.name}
                            </div>
                            {isEmpty && (
                              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-semibold">
                                Vuoto
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 mb-2">{level.description}</div>

                          {/* Progress Bar */}
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full bg-gradient-to-r ${level.color} transition-all duration-500`}
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              />
                            </div>
                            <div className="text-sm font-semibold text-gray-700 min-w-[100px]">
                              <span className="text-xs text-gray-500">SVG:</span> {svgPresent} / {totalKanji}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      {isSelected && !isEmpty && (
                        <div className="bg-matcha text-white px-3 py-1 rounded-full text-xs font-bold flex-shrink-0">
                          Attivo
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Suggerimento per livello vuoto selezionato */}
                  {isSelected && isEmpty && (
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex gap-2 items-start">
                        <span className="text-amber-600 text-lg">⚠️</span>
                        <div className="text-sm text-amber-800 flex-1">
                          <strong>Livello vuoto.</strong> Scarica i dati con:
                          <code className="block mt-1 bg-amber-100 px-2 py-1 rounded text-xs font-mono">
                            node scripts/sync-kanji.js --level={level.code}
                          </code>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex gap-2">
              <span className="text-blue-600 text-xl">ℹ️</span>
              <div className="text-sm text-blue-800">
                <strong>Nota:</strong> Le modifiche vengono salvate automaticamente e applicate immediatamente a tutti i moduli.
                Se deselezioni tutti i livelli, il widget "Kanji del Giorno" sarà nascosto.
              </div>
            </div>
          </div>
        </div>

        {/* Current Selection Summary */}
        <div className="card-wabi mt-6 bg-gradient-to-br from-gray-50 to-white">
          <h3 className="text-lg font-bold text-sumi mb-3">Riepilogo Selezione</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {selectedLevels.length > 0 ? (
              selectedLevels.map(code => {
                const level = levels.find(l => l.code === code);
                return (
                  <div
                    key={code}
                    className={`px-4 py-2 rounded-lg text-white font-bold bg-gradient-to-r ${level.color}`}
                  >
                    {code}
                  </div>
                );
              })
            ) : (
              <div className="text-gray-500 italic">Nessun livello selezionato</div>
            )}
          </div>
        </div>

        {/* Daily Cards Target */}
        <div className="card-wabi mt-6">
          <h3 className="text-lg font-bold text-sumi mb-3">🃏 Carte Giornaliere FlashCards</h3>
          <p className="text-sm text-gray-600 mb-4">
            Quante nuove carte vuoi studiare ogni giorno? (Frasi + Kanji combinati)
          </p>

          <div className="flex items-center gap-4 mb-3">
            <div className="flex-1">
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={dailyTarget}
                onChange={(e) => setDailyTarget(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-matcha"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>5</span>
                <span>15</span>
                <span>25</span>
                <span>35</span>
                <span>50</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-matcha min-w-[60px] text-center">
              {dailyTarget}
            </div>
          </div>

          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-xs text-green-800">
              ℹ️ <strong>Esempio:</strong> Con {dailyTarget} carte, riceverai circa {Math.floor(dailyTarget * 0.6)} frasi + {Math.floor(dailyTarget * 0.4)} kanji nuovi ogni giorno.
            </div>
          </div>
        </div>

        {/* Reset Cache */}
        <div className="card-wabi mt-6 bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200">
          <h3 className="text-lg font-bold text-red-900 mb-3">🗑️ Gestione Cache</h3>
          <p className="text-sm text-red-800 mb-4">
            Pulisci tutti i dati salvati localmente (selezione livelli, kanji del giorno, progressi).
            Utile per vedere immediatamente i nuovi dati caricati nel database.
          </p>

          {!showResetConfirm ? (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              Pulisci LocalStorage
            </button>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-red-100 border border-red-300 rounded-lg">
                <strong className="text-red-900">⚠️ Conferma:</strong>
                <p className="text-sm text-red-800 mt-1">
                  Questa operazione eliminerà tutti i dati salvati. Sei sicuro?
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    localStorage.clear();
                    alert('✅ Cache pulita! La pagina verrà ricaricata.');
                    window.location.reload();
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                  Sì, Pulisci Tutto
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors"
                >
                  Annulla
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
