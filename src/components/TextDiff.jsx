import React from 'react';

/**
 * TextDiff - Visualizza differenze (Wabi-Sabi)
 * Evidenzia caratteri corretti (verde), errati (rosso), mancanti (oro)
 */
export default function TextDiff({ userInput, target }) {
  if (!userInput || !target) return null;

  // Normalize: rimuovi punteggiatura per confronto
  const normalizeText = (text) => text.trim().replace(/[。、！？!?,\.]/g, '');
  const normalizedInput = normalizeText(userInput);
  const normalizedTarget = normalizeText(target);

  const maxLength = Math.max(normalizedInput.length, normalizedTarget.length);
  const chars = [];

  // Genera array di caratteri con stato
  for (let i = 0; i < maxLength; i++) {
    const userChar = normalizedInput[i] || '';
    const targetChar = normalizedTarget[i] || '';

    let status = 'correct';
    let displayChar = targetChar;

    if (!userChar && targetChar) {
      // Carattere mancante
      status = 'missing';
    } else if (userChar !== targetChar) {
      // Carattere errato
      status = 'wrong';
    }

    chars.push({
      targetChar,
      userChar,
      status,
      index: i
    });
  }

  // Wabi-Sabi colors
  const colors = {
    correct: '#6B8E23',  // Matcha
    wrong: '#BC002D',    // Hinomaru
    missing: '#E9B824'   // Kintsugi
  };

  return (
    <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
      {/* Header */}
      <div className="text-xs font-semibold mb-3 opacity-70">
        📝 Confronto dettagliato:
      </div>

      {/* Diff visualization */}
      <div className="flex flex-wrap gap-1 mb-3">
        {chars.map((item, idx) => {
          let color = colors.correct;
          let bgColor = 'transparent';
          let textDecoration = 'none';

          if (item.status === 'wrong') {
            color = colors.wrong;
            bgColor = 'rgba(188, 0, 45, 0.1)';
          } else if (item.status === 'missing') {
            color = colors.missing;
            bgColor = 'rgba(233, 184, 36, 0.1)';
            textDecoration = 'underline dashed';
          }

          return (
            <span
              key={idx}
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color,
                backgroundColor: bgColor,
                padding: '4px 6px',
                borderRadius: '4px',
                textDecoration,
                transition: 'all 0.2s'
              }}
              title={
                item.status === 'wrong'
                  ? `Hai scritto: ${item.userChar}`
                  : item.status === 'missing'
                  ? 'Carattere mancante'
                  : 'Corretto'
              }
            >
              {item.targetChar}
            </span>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: colors.correct }}
          />
          <span className="opacity-70">Corretto</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: colors.wrong }}
          />
          <span className="opacity-70">Errato</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: colors.missing }}
          />
          <span className="opacity-70">Mancante</span>
        </div>
      </div>

      {/* User input display */}
      <div className="mt-3 pt-3 border-t border-current opacity-50">
        <div className="text-xs mb-1">Hai scritto:</div>
        <div className="font-mono text-sm">{normalizedInput}</div>
        {normalizedInput !== userInput && (
          <div className="text-xs mt-1 opacity-70">(punteggiatura ignorata)</div>
        )}
      </div>
    </div>
  );
}
