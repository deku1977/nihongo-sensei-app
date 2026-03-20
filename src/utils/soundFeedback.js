/**
 * Sound Feedback Utility
 * Genera suoni procedurali usando Web Audio API (no file audio)
 */

/**
 * Suono di successo (score >= 90)
 * Triade maggiore ascendente + riverbero
 */
export function playSuccessSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Note della triade maggiore (C-E-G in Hz)
    const notes = [523.25, 659.25, 783.99]; // Do5, Mi5, Sol5

    notes.forEach((freq, idx) => {
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);

      // Envelope ADSR
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start(audioCtx.currentTime + idx * 0.1);
      oscillator.stop(audioCtx.currentTime + idx * 0.1 + 0.6);
    });

    // Cleanup
    setTimeout(() => audioCtx.close(), 1000);
  } catch (error) {
    console.warn('[SoundFeedback] Audio context not supported:', error);
  }
}

/**
 * Suono di parziale successo (score 70-89)
 * Due note ascendenti
 */
export function playGoodSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const notes = [440, 554.37]; // La4, Do#5

    notes.forEach((freq, idx) => {
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);

      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start(audioCtx.currentTime + idx * 0.1);
      oscillator.stop(audioCtx.currentTime + idx * 0.1 + 0.4);
    });

    setTimeout(() => audioCtx.close(), 600);
  } catch (error) {
    console.warn('[SoundFeedback] Audio context not supported:', error);
  }
}

/**
 * Suono di fallimento (score < 70)
 * Nota discendente con distorsione
 */
export function playFailSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.3);

    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.35);

    setTimeout(() => audioCtx.close(), 500);
  } catch (error) {
    console.warn('[SoundFeedback] Audio context not supported:', error);
  }
}

/**
 * Suono di click/draw (feedback tattile)
 * Breve tick per ogni tratto completato
 */
export function playDrawSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);

    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.05);

    setTimeout(() => audioCtx.close(), 100);
  } catch (error) {
    console.warn('[SoundFeedback] Audio context not supported:', error);
  }
}
