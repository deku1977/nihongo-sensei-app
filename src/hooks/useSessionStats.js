import { useState, useEffect, useCallback } from 'react';

const SESSION_STORAGE_KEY = 'nihongo-sensei-session-stats';

/**
 * Custom hook per gestire statistiche sessione con persistenza
 * Usa sessionStorage per mantenere dati al cambio tab, reset alla chiusura browser
 */
export default function useSessionStats() {
  const [sessionData, setSessionData] = useState(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (err) {
      console.warn('[useSessionStats] Failed to load from sessionStorage:', err);
    }

    return {
      completedIds: [],      // Array di ID frasi completate
      completedCount: 0,     // Contatore totale
      streak: 0,             // Streak corrente
      lastCompletedAt: null  // Timestamp ultima completata
    };
  });

  /**
   * Persist to sessionStorage whenever data changes
   */
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    } catch (err) {
      console.warn('[useSessionStats] Failed to save to sessionStorage:', err);
    }
  }, [sessionData]);

  /**
   * Mark sentence as completed
   * @param {number} sentenceId - ID della frase completata
   */
  const markCompleted = useCallback((sentenceId) => {
    setSessionData(prev => {
      // Check if already completed
      if (prev.completedIds.includes(sentenceId)) {
        return prev;
      }

      return {
        completedIds: [...prev.completedIds, sentenceId],
        completedCount: prev.completedCount + 1,
        streak: prev.streak + 1,
        lastCompletedAt: Date.now()
      };
    });
  }, []);

  /**
   * Reset streak (when user skips or fails)
   */
  const resetStreak = useCallback(() => {
    setSessionData(prev => ({
      ...prev,
      streak: 0
    }));
  }, []);

  /**
   * Reset all session stats
   */
  const resetSession = useCallback(() => {
    const emptyData = {
      completedIds: [],
      completedCount: 0,
      streak: 0,
      lastCompletedAt: null
    };
    setSessionData(emptyData);
  }, []);

  /**
   * Check if sentence is completed
   * @param {number} sentenceId
   * @returns {boolean}
   */
  const isCompleted = useCallback((sentenceId) => {
    return sessionData.completedIds.includes(sentenceId);
  }, [sessionData.completedIds]);

  return {
    // Data
    completedIds: sessionData.completedIds,
    completedCount: sessionData.completedCount,
    streak: sessionData.streak,
    lastCompletedAt: sessionData.lastCompletedAt,

    // Actions
    markCompleted,
    resetStreak,
    resetSession,
    isCompleted
  };
}
