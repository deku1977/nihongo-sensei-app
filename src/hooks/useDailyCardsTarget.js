import { useState, useEffect } from 'react';

const STORAGE_KEY = 'nihongo_daily_cards_target';
const DEFAULT_TARGET = 15;

/**
 * Hook per gestire il target di carte giornaliere
 * Persiste in localStorage
 */
export default function useDailyCardsTarget() {
  const [dailyTarget, setDailyTarget] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : DEFAULT_TARGET;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, dailyTarget.toString());
  }, [dailyTarget]);

  return { dailyTarget, setDailyTarget };
}
