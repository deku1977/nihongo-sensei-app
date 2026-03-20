import { useState, useEffect } from 'react';
import useJLPTLevels from './useJLPTLevels';
import kanjiMaster from '../database/kanji_master.json';
import sentences from '../database/sentences.json';
import { COMMON_VERBS } from '../utils/nihongoEngine';

/**
 * Hook per calcolare progresso globale attraverso tutti i moduli
 * Si adatta dinamicamente ai livelli JLPT selezionati
 *
 * Traccia:
 * - Kanji masterizzati (KakiBoard) per livelli selezionati
 * - Verbi completati (VerbLab)
 * - Frasi completate (Dictation Master)
 * - Dungeon completati (BattleDungeon)
 */
export default function useGlobalProgress() {
  const { selectedLevels } = useJLPTLevels();
  const [globalProgress, setGlobalProgress] = useState({
    completed: 0,
    total: 0,
    percentage: 0,
    breakdown: {
      kanji: { completed: 0, total: 0 },
      verbs: { completed: 0, total: 0 },
      sentences: { completed: 0, total: 0 },
      dungeons: { completed: 0, total: 0 }
    }
  });

  useEffect(() => {
    const calculateProgress = () => {
      // 1. KANJI (basato su livelli selezionati)
      const availableKanji = selectedLevels.flatMap(level => kanjiMaster[level] || []);
      const kanjiTotal = availableKanji.length;
      const masteredKanji = JSON.parse(localStorage.getItem('mastered_kanji') || '[]');
      const kanjiCompleted = masteredKanji.filter(k =>
        availableKanji.some(ak => ak.kanji === k)
      ).length;

      // 2. VERBI (tutti i verbi comuni)
      const verbsTotal = COMMON_VERBS.length;
      const completedVerbs = JSON.parse(localStorage.getItem('completed_verbs') || '[]');
      const verbsCompleted = completedVerbs.length;

      // 3. FRASI (dictation master)
      const sentencesTotal = sentences.length;
      const completedSentences = JSON.parse(localStorage.getItem('session_stats') || '{"completedIds":[]}');
      const sentencesCompleted = new Set(completedSentences.completedIds).size;

      // 4. DUNGEONS
      const dungeonsTotal = 10; // Obiettivo: completare 10 dungeon
      const playerProgress = JSON.parse(localStorage.getItem('player_progress') || '{}');
      const dungeonsCompleted = Math.min(playerProgress.dungeonsCleared || 0, dungeonsTotal);

      // TOTALE GLOBALE
      const totalItems = kanjiTotal + verbsTotal + sentencesTotal + dungeonsTotal;
      const completedItems = kanjiCompleted + verbsCompleted + sentencesCompleted + dungeonsCompleted;
      const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      setGlobalProgress({
        completed: completedItems,
        total: totalItems,
        percentage,
        breakdown: {
          kanji: { completed: kanjiCompleted, total: kanjiTotal },
          verbs: { completed: verbsCompleted, total: verbsTotal },
          sentences: { completed: sentencesCompleted, total: sentencesTotal },
          dungeons: { completed: dungeonsCompleted, total: dungeonsTotal }
        }
      });
    };

    calculateProgress();

    // Ricalcola quando la finestra torna in focus (dopo aver completato un modulo)
    window.addEventListener('focus', calculateProgress);
    return () => window.removeEventListener('focus', calculateProgress);
  }, [selectedLevels]);

  return globalProgress;
}
