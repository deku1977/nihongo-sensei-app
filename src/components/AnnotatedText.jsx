import React, { useState } from 'react';
import { parsePhoneticAnnotations } from '../utils/phoneticParser';

/**
 * AnnotatedText - Renderizza testo con annotazioni fonetiche
 * Supporta marker [...] per vowel compression e altri hint
 *
 * @param {string} text - Testo con marker (es. "で[す]")
 * @param {string} className - CSS classes per styling base
 * @param {Object} theme - Theme styles object
 */
export default function AnnotatedText({ text, className = '' }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [pinnedIndex, setPinnedIndex] = useState(null);

  if (!text) return null;

  const tokens = parsePhoneticAnnotations(text);

  return (
    <span className={className}>
      {tokens.map((token, idx) => {
        if (!token.isAnnotated) {
          // Testo normale
          return <span key={idx}>{token.text}</span>;
        }

        // Carattere annotato con hint (vowel compression, silent sounds)
        const isTooltipVisible = hoveredIndex === idx || pinnedIndex === idx;

        return (
          <span
            key={idx}
            className="relative inline-block"
            onMouseEnter={() => setHoveredIndex(idx)}
            onMouseLeave={() => {
              // Non chiudere se pinnato
              if (pinnedIndex !== idx) {
                setHoveredIndex(null);
              }
            }}
            onClick={() => {
              // Toggle pin: click per bloccare/sbloccare tooltip
              setPinnedIndex(pinnedIndex === idx ? null : idx);
            }}
          >
            {/* Carattere annotato: sottolineato in Kintsugi Gold */}
            <span
              className="cursor-pointer transition-all inline-block font-mincho"
              style={{
                transform: isTooltipVisible ? 'scale(1.15)' : 'scale(1)',
                borderBottom: `2px dashed ${isTooltipVisible ? '#BC002D' : '#E9B824'}`,
                color: isTooltipVisible ? '#BC002D' : '#2C2C2C',
                opacity: isTooltipVisible ? 1 : 0.8,
                paddingBottom: '2px',
                fontWeight: isTooltipVisible ? 'bold' : 'normal'
              }}
            >
              {token.text}
            </span>

            {/* Tooltip Wabi-Sabi */}
            {isTooltipVisible && (
              <div
                className="absolute left-1/2 bottom-full mb-2 transform -translate-x-1/2 z-50 bg-white border-2 border-hinomaru text-sumi px-4 py-3 rounded-lg shadow-hanko text-xs font-normal"
                style={{
                  minWidth: '220px',
                  maxWidth: '320px',
                  whiteSpace: 'normal',
                  pointerEvents: pinnedIndex === idx ? 'auto' : 'none'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header con indicatore pin */}
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">🎤 Hint fonetico</div>
                  {pinnedIndex === idx && (
                    <button
                      onClick={() => setPinnedIndex(null)}
                      className="text-xs opacity-70 hover:opacity-100 ml-2 px-1"
                      title="Chiudi"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Arrow */}
                <div
                  className={`absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0`}
                  style={{
                    borderLeft: '8px solid transparent',
                    borderRight: '8px solid transparent',
                    borderTop: `8px solid currentColor`
                  }}
                />

                {/* Hint text */}
                <div className="opacity-90 leading-relaxed">{token.hint}</div>

                {/* Istruzioni interattività */}
                {pinnedIndex !== idx && (
                  <div className="text-xs opacity-50 mt-2 border-t pt-2 border-current">
                    💡 Click per bloccare il tooltip
                  </div>
                )}
              </div>
            )}
          </span>
        );
      })}
    </span>
  );
}
