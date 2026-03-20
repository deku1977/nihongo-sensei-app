import React, { useState, useRef, useEffect } from 'react';

/**
 * FlipCard - Carta Anki-Style (Wabi-Sabi)
 * Supporta due tipi:
 * - "sentence": Fronte JP → Retro JP + Reading + IT + Audio
 * - "kanji": Fronte Kanji → Retro Significato + Letture + Esempi
 */
export default function FlipCard({ sentence, onFlip }) {
  const isKanjiCard = sentence.type === 'kanji';
  const [isFlipped, setIsFlipped] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    if (onFlip) onFlip(!isFlipped);
  };

  // Auto-play audio quando gira sul retro
  useEffect(() => {
    if (isFlipped && audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [isFlipped]);

  const handlePlayAudio = (e) => {
    e.stopPropagation();
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  return (
    <div className="perspective-container" style={{ perspective: '1000px' }}>
      <div
        className={`flip-card ${isFlipped ? 'flipped' : ''}`}
        onClick={handleFlip}
        style={{
          width: '100%',
          height: '450px',
          position: 'relative',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1)',
          cursor: 'pointer',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
        }}
      >
        {/* FRONTE: Domanda */}
        <div
          className="card-face card-front"
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden'
          }}
        >
          <div className="card-wabi h-full flex flex-col items-center justify-center bg-gradient-to-br from-white to-washi">
            {isKanjiCard ? (
              /* Kanji Card: Solo il kanji gigante */
              <>
                <div className="text-9xl font-bold text-sumi text-center font-mincho">
                  {sentence.kanji}
                </div>
                <div className="text-sm text-gray-400 mt-12">
                  👆 Clicca per vedere significato e letture
                </div>
              </>
            ) : (
              /* Sentence Card: Giapponese (Domanda) */
              <>
                <div className="text-6xl font-bold text-sumi text-center px-8 font-mincho leading-relaxed">
                  {sentence.japanese}
                </div>
                <div className="text-sm text-gray-400 mt-12">
                  👆 Clicca per vedere la risposta
                </div>
              </>
            )}
          </div>
        </div>

        {/* RETRO: Risposta */}
        <div
          className="card-face card-back"
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)'
          }}
        >
          <div className="card-wabi h-full flex flex-col items-center justify-center bg-gradient-to-br from-washi to-white border-2 border-sumi/10 p-8 overflow-y-auto">
            {isKanjiCard ? (
              /* Kanji Card: Significato + Letture + Esempi */
              <>
                {/* Significato */}
                <div className="text-4xl font-bold text-sumi text-center mb-6">
                  {sentence.meaning}
                </div>

                {/* Letture */}
                <div className="w-full max-w-md mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-xs text-blue-600 font-semibold mb-1">音読み (Onyomi)</div>
                      <div className="text-2xl font-bold text-blue-700 font-mincho">
                        {sentence.onyomi || '-'}
                      </div>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="text-xs text-green-600 font-semibold mb-1">訓読み (Kunyomi)</div>
                      <div className="text-2xl font-bold text-green-700 font-mincho">
                        {sentence.kunyomi || '-'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Esempi */}
                {sentence.examples && sentence.examples.length > 0 && (
                  <div className="w-full max-w-md">
                    <div className="text-sm text-gray-600 font-semibold mb-2">📝 Esempi:</div>
                    <div className="space-y-2">
                      {sentence.examples.slice(0, 3).map((ex, idx) => (
                        <div key={idx} className="p-2 bg-gray-50 rounded border border-gray-200">
                          <div className="font-bold text-sumi font-mincho">{ex.word}</div>
                          <div className="text-sm text-gray-600 font-mincho">{ex.reading}</div>
                          <div className="text-sm text-gray-500 italic">{ex.meaning}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hint */}
                <div className="text-xs text-gray-400 mt-6">
                  👆 Clicca per tornare al kanji
                </div>
              </>
            ) : (
              /* Sentence Card: Giapponese + Reading + Traduzione + Audio */
              <>
                {/* Top: Giapponese */}
                <div className="text-5xl font-bold text-sumi text-center mb-4 font-mincho">
                  {sentence.japanese}
                </div>

                {/* Middle: Reading (Hiragana) - Grigio fumo */}
                <div className="text-3xl text-center mb-8 font-mincho" style={{ color: '#555555' }}>
                  {sentence.reading}
                </div>

                {/* Bottom: Traduzione Italiana (stile citazione) */}
                <div className="border-l-4 border-hinomaru/30 pl-4 mb-8">
                  <p className="text-xl text-gray-700 italic">
                    {sentence.italian || sentence.english}
                  </p>
                </div>

                {/* Audio Button */}
                <button
                  onClick={handlePlayAudio}
                  className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                    isPlaying
                      ? 'bg-matcha text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {isPlaying ? '⏸️ Pause' : '▶️ Riascolta'}
                </button>

                {/* Audio element */}
                <audio
                  ref={audioRef}
                  src={`/audio/dictation/${sentence.id}.mp3`}
                  onEnded={handleAudioEnded}
                  preload="auto"
                />

                {/* Hint */}
                <div className="text-xs text-gray-400 mt-6">
                  👆 Clicca per tornare alla domanda
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .flip-card {
          transition: transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1);
        }
      `}</style>
    </div>
  );
}
