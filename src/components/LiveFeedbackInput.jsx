import React from 'react';

/**
 * LiveFeedbackInput - Input con evidenziazione real-time dei caratteri corretti
 *
 * Mostra in verde (Matcha) i caratteri che matchano con il target
 */
export default function LiveFeedbackInput({ value, onChange, target, disabled, placeholder }) {
  // Normalizza target (rimuove punteggiatura)
  const normalizedTarget = target.trim().replace(/[。、！？!?,\.]/g, '');

  // Calcola quali caratteri sono corretti
  const getCharacterStates = () => {
    if (!value || !normalizedTarget) return [];

    const chars = [];
    const userChars = value.split('');
    const targetChars = normalizedTarget.split('');

    for (let i = 0; i < userChars.length; i++) {
      const isCorrect = i < targetChars.length && userChars[i] === targetChars[i];
      chars.push({
        char: userChars[i],
        isCorrect,
        index: i
      });
    }

    return chars;
  };

  const characterStates = getCharacterStates();

  return (
    <div className="relative">
      {/* Input field invisibile (solo per gestire focus e cursor) */}
      <input
        type="text"
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full px-6 py-4 rounded-lg text-xl border-2 border-gray-200 focus:border-hinomaru outline-none transition-all font-mincho bg-white"
        autoFocus
        style={{
          color: 'transparent',
          caretColor: '#BC002D'
        }}
      />

      {/* Overlay con testo colorato */}
      <div
        className="absolute top-0 left-0 right-0 bottom-0 px-6 py-4 pointer-events-none text-xl font-mincho"
        style={{
          lineHeight: '1.5',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        {value.length === 0 ? (
          // Placeholder quando vuoto
          <span style={{ color: '#9CA3AF' }}>{placeholder}</span>
        ) : (
          // Caratteri colorati
          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {characterStates.map((state, idx) => (
              <span
                key={idx}
                style={{
                  color: state.isCorrect ? '#6B8E23' : '#2C2C2C',
                  fontWeight: state.isCorrect ? '700' : 'normal'
                }}
              >
                {state.char}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
