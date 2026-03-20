import React from 'react';
import useSessionStats from '../hooks/useSessionStats';

/**
 * SessionDashboard - Dashboard statistiche sessione (Wabi-Sabi)
 * Mostra progresso, streak, e dettagli frasi completate
 */
export default function SessionDashboard({ totalSentences = 79 }) {
  const { completedIds, completedCount, streak, lastCompletedAt } = useSessionStats();

  const uniqueCompleted = new Set(completedIds).size;
  const progressPercentage = Math.round((uniqueCompleted / totalSentences) * 100);

  const formatLastCompleted = () => {
    if (!lastCompletedAt) return 'Mai';

    const now = Date.now();
    const diffMs = now - lastCompletedAt;
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) return 'Adesso';
    if (diffMinutes < 60) return `${diffMinutes}m fa`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h fa`;
    return `${Math.floor(diffMinutes / 1440)}g fa`;
  };

  return (
    <div className="card-wabi">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-sumi">
          📊 Session Dashboard
        </h3>
        <div className="text-sm text-gray-500">
          {formatLastCompleted()}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-sumi">
            Progresso Totale
          </span>
          <span className="text-sm font-bold text-hinomaru">
            {progressPercentage}%
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-matcha to-bamboo transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {uniqueCompleted} / {totalSentences} frasi uniche completate
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Completate */}
        <div className="p-4 rounded-lg bg-gray-50">
          <div className="text-2xl font-bold text-sumi mb-1">
            {completedCount}
          </div>
          <div className="text-xs text-gray-500">
            Tentativi completati
          </div>
        </div>

        {/* Streak */}
        <div className="p-4 rounded-lg bg-orange-50">
          <div className="text-2xl font-bold text-hinomaru mb-1">
            🔥 {streak}
          </div>
          <div className="text-xs text-gray-500">
            Streak corrente
          </div>
        </div>

        {/* Efficienza */}
        <div className="p-4 rounded-lg bg-green-50">
          <div className="text-2xl font-bold text-matcha mb-1">
            {completedCount > 0 ? Math.round((uniqueCompleted / completedCount) * 100) : 0}%
          </div>
          <div className="text-xs text-gray-500">
            Efficienza
          </div>
        </div>
      </div>

      {/* Info Footer */}
      <div className="mt-4 p-3 rounded-lg border bg-blue-50 border-blue-200">
        <div className="text-xs text-gray-600">
          💡 <span className="font-semibold">Tip:</span> Le statistiche si resettano alla chiusura del browser. Usa il pulsante "Rimescola" per azzerare la sessione.
        </div>
      </div>
    </div>
  );
}
