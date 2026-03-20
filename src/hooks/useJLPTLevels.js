import { useState, useEffect } from 'react';

const STORAGE_KEY = 'nihongo_jlpt_levels';
const DEFAULT_LEVELS = ['N5']; // Default: solo N5 attivo

/**
 * Hook per gestire i livelli JLPT selezionati
 * Persiste in localStorage
 * @returns {{ selectedLevels: string[], toggleLevel: (level: string) => void, setLevels: (levels: string[]) => void }}
 */
export default function useJLPTLevels() {
  const [selectedLevels, setSelectedLevels] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_LEVELS;
  });

  /**
   * Persist to localStorage on change
   */
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedLevels));
  }, [selectedLevels]);

  /**
   * Toggle single level on/off
   * @param {string} level - Level code (N5, N4, N3, N2, N1)
   */
  const toggleLevel = (level) => {
    setSelectedLevels(prev =>
      prev.includes(level)
        ? prev.filter(l => l !== level)
        : [...prev, level]
    );
  };

  /**
   * Set levels array directly
   * @param {string[]} levels
   */
  const setLevels = (levels) => {
    setSelectedLevels(levels);
  };

  return {
    selectedLevels,
    toggleLevel,
    setLevels
  };
}
