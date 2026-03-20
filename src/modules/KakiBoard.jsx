import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import useJLPTLevels from '../hooks/useJLPTLevels';
import kanjiMaster from '../database/kanji_master.json';
import { loadKanjiData } from '../utils/svgLoader';
import { evaluateKanji } from '../utils/vectorMatcher';
import { playSuccessSound, playGoodSound, playFailSound, playDrawSound } from '../utils/soundFeedback';

/**
 * KakiBoard - Pratica Scrittura Kanji (Wabi-Sabi Theme)
 * Porting fedele dal progetto Multitools con design Wabi-Sabi
 */
export default function KakiBoard() {
  const location = useLocation();
  const { selectedLevels } = useJLPTLevels();
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const isDrawingRef = useRef(false);
  const pathsHistoryRef = useRef([]);
  const currentPathRef = useRef([]);

  const [showReference, setShowReference] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentKanji, setCurrentKanji] = useState(null);
  const [kanjiSVGData, setKanjiSVGData] = useState(null);
  const [score, setScore] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [showStamp, setShowStamp] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showStrokeOrder, setShowStrokeOrder] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false); // Feedback visivo rosso/verde
  const [currentStrokeHint, setCurrentStrokeHint] = useState(0); // Per animazione stroke order
  const [strokeCount, setStrokeCount] = useState(0); // Contatore tratti per re-render hints
  const [kanjiData, setKanjiData] = useState([]); // Lista kanji filtrata per livelli

  // Carica kanji filtrati per livelli selezionati
  useEffect(() => {
    const availableKanji = selectedLevels.flatMap(level => kanjiMaster[level] || []);
    setKanjiData(availableKanji);

    // Reset index se fuori range
    if (currentIndex >= availableKanji.length) {
      setCurrentIndex(0);
    }
  }, [selectedLevels]);

  // Gestione kanji pre-selezionato da KanjiWidget
  useEffect(() => {
    if (location.state?.selectedKanji && kanjiData.length > 0) {
      const kanjiIndex = kanjiData.findIndex(k => k.kanji === location.state.selectedKanji);
      if (kanjiIndex !== -1) {
        setCurrentIndex(kanjiIndex);
      }
    }
  }, [location.state, kanjiData]);

  // Load kanji at current index
  useEffect(() => {
    if (kanjiData.length > 0) {
      loadKanjiAtIndex(currentIndex);
    }
  }, [currentIndex, kanjiData]);

  const loadKanjiAtIndex = async (index) => {
    if (!kanjiData || kanjiData.length === 0) return;

    const selectedKanji = kanjiData[index];
    if (!selectedKanji) return;

    setCurrentKanji(selectedKanji);

    try {
      const svgData = await loadKanjiData(selectedKanji.kanji);

      // Validazione dati SVG
      if (!svgData || !svgData.coordinates || svgData.coordinates.length === 0) {
        throw new Error('Invalid SVG data');
      }

      const validStrokes = svgData.coordinates.filter(coord => coord.points && coord.points.length > 0);

      if (validStrokes.length === 0) {
        throw new Error('No valid strokes');
      }

      const validatedSVGData = {
        ...svgData,
        coordinates: validStrokes
      };

      setKanjiSVGData(validatedSVGData);
    } catch (error) {
      console.warn('[KakiBoard] SVG not available:', selectedKanji.kanji);
      setKanjiSVGData({
        kanji: selectedKanji.kanji,
        coordinates: [],
        hints: [],
        paths: [],
        fallback: true,
        expectedStrokes: selectedKanji.strokes
      });
    }
  };

  // Canvas helper functions (defined BEFORE useLayoutEffect)
  const clearCanvas = () => {
    try {
      const context = ctxRef.current;
      const canvas = canvasRef.current;
      if (!context || !canvas) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
    } catch (error) {
      console.error('[KakiBoard] Error clearing canvas:', error);
    }
  };

  const getCoordinates = (e) => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      return { x, y };
    } catch (error) {
      console.error('[KakiBoard] Error getting coordinates:', error);
      return { x: 0, y: 0 };
    }
  };

  const startDrawing = (e) => {
    try {
      const context = ctxRef.current;
      if (!context) return;

      isDrawingRef.current = true;
      setIsDrawing(true);
      const { x, y } = getCoordinates(e);

      currentPathRef.current = [{ x, y }];

      context.strokeStyle = '#2C2C2C'; // Sumi
      context.lineWidth = 5;
      context.lineCap = 'round';
      context.lineJoin = 'round';

      context.beginPath();
      context.moveTo(x, y);
    } catch (error) {
      console.error('[KakiBoard] Error starting drawing:', error);
      isDrawingRef.current = false;
      setIsDrawing(false);
    }
  };

  const draw = (e) => {
    try {
      const context = ctxRef.current;
      if (!isDrawingRef.current || !context) return;

      const { x, y } = getCoordinates(e);
      currentPathRef.current.push({ x, y });

      context.lineTo(x, y);
      context.stroke();
    } catch (error) {
      console.error('[KakiBoard] Error drawing:', error);
    }
  };

  const stopDrawing = () => {
    try {
      if (isDrawingRef.current && currentPathRef.current.length > 1) {
        pathsHistoryRef.current.push([...currentPathRef.current]);
        currentPathRef.current = [];
        // Aggiorna contatore per triggherare re-render degli hints
        setStrokeCount(pathsHistoryRef.current.length);
        // Feedback sonoro per tratto completato
        playDrawSound();
      }
      isDrawingRef.current = false;
      setIsDrawing(false);
    } catch (error) {
      console.error('[KakiBoard] Error stopping drawing:', error);
      isDrawingRef.current = false;
      setIsDrawing(false);
    }
  };

  // Initialize canvas
  useLayoutEffect(() => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) {
        console.warn('[KakiBoard] Canvas ref not available');
        return;
      }

      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) {
        console.error('[KakiBoard] Failed to get 2d context');
        return;
      }

      // High-DPI Support
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      context.scale(dpr, dpr);

      // Brush config (Sumi ink)
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.lineWidth = 5;
      context.strokeStyle = '#2C2C2C'; // Sumi

      ctxRef.current = context;
      clearCanvas();

      // Event listeners
      const handleMouseDown = (e) => startDrawing(e);
      const handleMouseMove = (e) => {
        if (isDrawingRef.current) draw(e);
      };
      const handleMouseUp = () => stopDrawing();

      const handleTouchStart = (e) => {
        e.preventDefault();
        startDrawing(e.touches[0]);
      };
      const handleTouchMove = (e) => {
        e.preventDefault();
        if (isDrawingRef.current) draw(e.touches[0]);
      };
      const handleTouchEnd = (e) => {
        e.preventDefault();
        stopDrawing();
      };

      canvas.addEventListener('mousedown', handleMouseDown);
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('mouseup', handleMouseUp);
      canvas.addEventListener('mouseleave', handleMouseUp);

      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
      canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

      return () => {
        canvas.removeEventListener('mousedown', handleMouseDown);
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mouseup', handleMouseUp);
        canvas.removeEventListener('mouseleave', handleMouseUp);
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.removeEventListener('touchmove', handleTouchMove);
        canvas.removeEventListener('touchend', handleTouchEnd);
      };
    } catch (error) {
      console.error('[KakiBoard] Error initializing canvas:', error);
    }
  }, []); // No dependencies - run once on mount

  const handleClear = () => {
    pathsHistoryRef.current = [];
    currentPathRef.current = [];
    setScore(null);
    setShowStamp(false);
    setShowFeedback(false);
    setCurrentStrokeHint(0);
    setStrokeCount(0);
    clearCanvas();
  };

  const handleShowSolution = () => {
    const context = ctxRef.current;
    const canvas = canvasRef.current;
    if (!context || !canvas) return;

    // Clear canvas
    clearCanvas();

    // Calcola dimensioni dinamiche
    const rect = canvas.getBoundingClientRect();
    const fontSize = Math.min(260, rect.width * 0.65);
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Disegna il kanji di riferimento sul canvas in Sumi
    context.font = `${fontSize}px serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#2C2C2C';
    context.fillText(currentKanji.kanji, centerX, centerY);

    // Reset dopo 3 secondi
    setTimeout(() => {
      handleClear();
    }, 3000);
  };

  const handleUndo = () => {
    if (pathsHistoryRef.current.length === 0) return;
    pathsHistoryRef.current.pop();
    setStrokeCount(pathsHistoryRef.current.length);
    redrawAllPaths();
  };

  const redrawAllPaths = () => {
    const context = ctxRef.current;
    if (!context) return;

    clearCanvas();

    context.strokeStyle = '#2C2C2C';
    context.lineWidth = 5;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    pathsHistoryRef.current.forEach(path => {
      if (path.length < 2) return;

      context.beginPath();
      context.moveTo(path[0].x, path[0].y);

      for (let i = 1; i < path.length; i++) {
        context.lineTo(path[i].x, path[i].y);
      }

      context.stroke();
    });
  };

  /**
   * Salva kanji come masterizzato se score >= 70
   */
  const saveKanjiProgress = (kanji, score) => {
    if (score >= 70) {
      const masteredKanji = JSON.parse(localStorage.getItem('mastered_kanji') || '[]');
      if (!masteredKanji.includes(kanji)) {
        masteredKanji.push(kanji);
        localStorage.setItem('mastered_kanji', JSON.stringify(masteredKanji));
      }
    }
  };

  const handleCheck = () => {
    if (!currentKanji || pathsHistoryRef.current.length === 0) return;

    // Basic scoring se SVG non disponibile
    if (!kanjiSVGData || !kanjiSVGData.coordinates || kanjiSVGData.coordinates.length === 0) {
      const drawnStrokes = pathsHistoryRef.current.length;
      const expectedStrokes = currentKanji.strokes;
      const basicScore = drawnStrokes === expectedStrokes ? 80 :
                        Math.floor((Math.min(drawnStrokes, expectedStrokes) / expectedStrokes) * 60);
      setScore(basicScore);
      setEvaluation(null);
      setShowStamp(true);
      setShowFeedback(true);
      drawFeedbackOverlay();

      // Salva progresso
      saveKanjiProgress(currentKanji.kanji, basicScore);

      // Feedback sonoro basato su score
      if (basicScore >= 90) playSuccessSound();
      else if (basicScore >= 70) playGoodSound();
      else playFailSound();

      setTimeout(() => {
        setShowStamp(false);
        setShowFeedback(false);
      }, 4000);
      return;
    }

    // Vector matching
    try {
      const result = evaluateKanji(pathsHistoryRef.current, kanjiSVGData.coordinates);
      setScore(result.score);
      setEvaluation(result);
      setShowStamp(true);
      setShowFeedback(true);
      drawFeedbackOverlay();

      // Salva progresso
      saveKanjiProgress(currentKanji.kanji, result.score);

      // Feedback sonoro basato su score
      if (result.score >= 90) playSuccessSound();
      else if (result.score >= 70) playGoodSound();
      else playFailSound();

      setTimeout(() => {
        setShowStamp(false);
        setShowFeedback(false);
      }, 4000);
    } catch (error) {
      console.error('[KakiBoard] Evaluation error:', error);
      setScore(0);
      setEvaluation(null);
      setShowStamp(true);
      playFailSound();
      setTimeout(() => setShowStamp(false), 4000);
    }
  };

  // Disegna feedback visivo rosso/verde
  const drawFeedbackOverlay = () => {
    const context = ctxRef.current;
    const canvas = canvasRef.current;
    if (!context || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Crea un canvas temporaneo per il kanji di riferimento (same size as main canvas)
    const refCanvas = document.createElement('canvas');
    refCanvas.width = canvas.width;
    refCanvas.height = canvas.height;
    const refCtx = refCanvas.getContext('2d');

    // Disegna kanji di riferimento in nero sul canvas temporaneo
    if (refCtx) {
      // Applica stesso scaling del canvas principale
      refCtx.scale(dpr, dpr);
      const fontSize = Math.min(260, rect.width * 0.65);
      refCtx.font = `${fontSize}px serif`;
      refCtx.textAlign = 'center';
      refCtx.textBaseline = 'middle';
      refCtx.fillStyle = '#000000';
      // Usa CSS size per posizionamento
      refCtx.fillText(currentKanji.kanji, rect.width / 2, rect.height / 2);
    }

    // Ottieni i pixel del kanji di riferimento
    const refImageData = refCtx.getImageData(0, 0, canvas.width, canvas.height);
    const refData = refImageData.data;

    // Ridisegna i tratti dell'utente con feedback colorato
    context.globalCompositeOperation = 'source-over';

    pathsHistoryRef.current.forEach(path => {
      if (path.length < 2) return;

      // Per ogni punto del path, verifica se è dentro/fuori
      for (let i = 0; i < path.length - 1; i++) {
        const x = Math.floor(path[i].x * dpr);
        const y = Math.floor(path[i].y * dpr);

        // Controlla se il punto è su area del kanji
        const pixelIndex = (y * canvas.width + x) * 4;
        const isOnKanji = refData[pixelIndex + 3] > 0; // Alpha > 0

        // Disegna linea con colore feedback (coordinate in CSS pixels)
        context.strokeStyle = isOnKanji ? '#6B8E23' : '#BC002D'; // Verde se OK, rosso se fuori
        context.lineWidth = 6;
        context.beginPath();
        context.moveTo(path[i].x, path[i].y);
        context.lineTo(path[i + 1].x, path[i + 1].y);
        context.stroke();
      }
    });

    // Reset composite operation
    context.globalCompositeOperation = 'source-over';
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      handleClear();
    }
  };

  const handleNext = () => {
    if (currentIndex < kanjiData.length - 1) {
      setCurrentIndex(prev => prev + 1);
      handleClear();
    }
  };

  const getScoreComment = (score) => {
    if (score >= 90) return '素晴らしい!'; // Eccellente!
    if (score >= 70) return '合格'; // Superato
    return 'もっと練習'; // Esercitati ancora
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#E9B824'; // Kintsugi Gold
    if (score >= 70) return '#6B8E23'; // Matcha Green
    return '#BC002D'; // Hinomaru Red
  };

  return (
    <div className="min-h-screen bg-washi py-3 md:py-12 px-2 md:px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="card-wabi mb-3 md:mb-6 p-3 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-sumi flex items-center gap-3">
              <span className="font-mincho">✍️</span>
              <span>KakiBoard</span>
            </h1>
            <div className="text-right">
              <div className="text-sm text-gray-500">Kanji</div>
              <div className="text-2xl font-bold text-hinomaru">
                {kanjiData.length > 0 ? `${currentIndex + 1} / ${kanjiData.length}` : '0 / 0'}
              </div>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            Pratica Scrittura Kanji JLPT {selectedLevels.join(', ') || 'Nessun livello selezionato'}
          </div>
          {kanjiData.length === 0 && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex gap-2 items-start">
                <span className="text-amber-600 text-lg">⚠️</span>
                <div className="text-sm text-amber-800">
                  <strong>Nessun kanji disponibile.</strong> Vai in{' '}
                  <a href="/settings" className="underline font-semibold">Impostazioni</a>{' '}
                  per selezionare i livelli JLPT e scaricare i dati.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-4 md:gap-8">
          {/* Canvas Area */}
          <div className="card-wabi p-3 md:p-6 lg:flex-1">
            {/* Canvas Wrapper */}
            <div
              className="canvas-wrapper"
              style={{
                position: 'relative',
                aspectRatio: '1',
                margin: '0 auto',
                border: '2px solid #E5E7EB',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: '#F9F7F2' // Washi background
              }}
            >
              {/* Background Layer (Griglia + Kanji Riferimento) */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 1,
                  pointerEvents: 'none',
                  userSelect: 'none'
                }}
              >
                {/* Griglia guida */}
                <svg width="100%" height="100%" viewBox="0 0 400 400" style={{ position: 'absolute', top: 0, left: 0 }}>
                  <line x1="200" y1="0" x2="200" y2="400" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
                  <line x1="0" y1="200" x2="400" y2="200" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
                </svg>

                {/* Kanji Riferimento (Grigio Chiaro) */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: showReference ? 0.2 : 0,
                    transition: 'opacity 0.3s ease',
                    pointerEvents: 'none'
                  }}
                >
                  <div
                    className="font-mincho"
                    style={{
                      fontSize: 'min(260px, 58vw)',
                      lineHeight: 1,
                      fontWeight: 'bold',
                      color: '#E0E0E0' // Grigio chiaro come richiesto
                    }}
                  >
                    {currentKanji ? currentKanji.kanji : ''}
                  </div>
                </div>

                {/* Stroke Order Hints (numeri) - Mostra solo il prossimo tratto */}
                {showStrokeOrder && kanjiSVGData && kanjiSVGData.hints && (
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                    {kanjiSVGData.hints
                      .filter(hint => {
                        // Mostra solo il prossimo tratto da disegnare
                        return hint.order === strokeCount + 1;
                      })
                      .map((hint, idx) => (
                        <div
                          key={idx}
                          style={{
                            position: 'absolute',
                            left: `${hint.x}px`,
                            top: `${hint.y}px`,
                            transform: 'translate(-50%, -50%)',
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: '#6B8E23', // Matcha
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            opacity: 0.9,
                            animation: 'pulse 2s ease-in-out infinite',
                            boxShadow: '0 2px 8px rgba(107, 142, 35, 0.5)'
                          }}
                        >
                          {hint.order}
                        </div>
                      ))}
                  </div>
                )}

                {/* CSS per animazione pulse */}
                <style>{`
                  @keyframes pulse {
                    0%, 100% {
                      transform: translate(-50%, -50%) scale(1);
                      opacity: 0.9;
                    }
                    50% {
                      transform: translate(-50%, -50%) scale(1.15);
                      opacity: 1;
                    }
                  }
                `}</style>
              </div>

              {/* Canvas Interattivo */}
              <canvas
                ref={canvasRef}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  zIndex: 10,
                  cursor: 'crosshair',
                  width: '100%',
                  height: '100%',
                  touchAction: 'none',
                  display: 'block'
                }}
              />

              {/* Hanko Stamp */}
              {showStamp && score !== null && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 20,
                    animation: 'stampAppear 0.5s ease-out'
                  }}
                >
                  {/* Glitter Effect per score >= 90 */}
                  {score >= 90 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '250px',
                        height: '250px',
                        background: 'radial-gradient(circle, rgba(233,184,36,0.4) 0%, transparent 70%)',
                        animation: 'glitterPulse 2s ease-in-out infinite',
                        pointerEvents: 'none'
                      }}
                    />
                  )}

                  <div
                    style={{
                      width: '180px',
                      height: '180px',
                      borderRadius: '50%',
                      border: `8px solid ${getScoreColor(score)}`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(255,255,255,0.98)',
                      transform: 'rotate(-12deg)',
                      boxShadow: score >= 90
                        ? '0 8px 40px rgba(233,184,36,0.6), 0 0 60px rgba(233,184,36,0.4)'
                        : '0 8px 30px rgba(0,0,0,0.3)',
                      position: 'relative'
                    }}
                  >
                    {/* Particelle dorate per score >= 90 */}
                    {score >= 90 && (
                      <>
                        <div className="particle particle-1" />
                        <div className="particle particle-2" />
                        <div className="particle particle-3" />
                        <div className="particle particle-4" />
                        <div className="particle particle-5" />
                        <div className="particle particle-6" />
                      </>
                    )}

                    <div className="font-mincho" style={{
                      fontSize: '56px',
                      fontWeight: 'bold',
                      color: getScoreColor(score),
                      lineHeight: 1,
                      textShadow: score >= 90 ? '0 0 20px rgba(233,184,36,0.5)' : 'none'
                    }}>
                      {getScoreComment(score)}
                    </div>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: 'bold',
                      color: getScoreColor(score),
                      marginTop: '8px',
                      opacity: 0.8
                    }}>
                      {score}%
                    </div>
                    {currentKanji && (
                      <div style={{
                        fontSize: '11px',
                        color: '#666',
                        marginTop: '6px',
                        opacity: 0.7
                      }}>
                        {pathsHistoryRef.current.length}/{currentKanji.strokes} tratti
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Stroke Hint Indicator */}
            {currentKanji && (
              <div className="text-center mt-2 md:mt-3 text-xs md:text-sm text-gray-600">
                <span className="font-semibold">Tratto {pathsHistoryRef.current.length} di {currentKanji.strokes}</span>
              </div>
            )}

            {/* Controls */}
            <div className="grid grid-cols-3 gap-1.5 md:gap-2 mt-3 md:mt-4">
              <button
                onClick={handleClear}
                className="btn-minimal py-1.5 md:py-2 text-xs md:text-sm font-semibold"
              >
                🗑️ <span className="hidden md:inline">Cancella</span>
              </button>
              <button
                onClick={handleUndo}
                className="btn-minimal py-1.5 md:py-2 text-xs md:text-sm font-semibold"
                disabled={pathsHistoryRef.current.length === 0}
              >
                ↶ <span className="hidden md:inline">Undo</span>
              </button>
              <button
                onClick={() => setShowReference(!showReference)}
                className="btn-minimal py-1.5 md:py-2 text-xs md:text-sm font-semibold"
              >
                👁️ <span className="hidden md:inline">{showReference ? 'Nascondi' : 'Guida'}</span>
              </button>
              <button
                onClick={() => setShowStrokeOrder(!showStrokeOrder)}
                className="btn-minimal py-1.5 md:py-2 text-xs md:text-sm font-semibold"
                disabled={!kanjiSVGData || !kanjiSVGData.hints}
              >
                🔢 <span className="hidden md:inline">{showStrokeOrder ? 'Nascondi' : 'Ordine'}</span>
              </button>
              <button
                onClick={handleShowSolution}
                className="btn-minimal py-1.5 md:py-2 text-xs md:text-sm font-semibold"
              >
                💡 <span className="hidden md:inline">Soluzione</span>
              </button>
              <button
                onClick={handleCheck}
                className="btn-accent py-1.5 md:py-2 text-xs md:text-sm font-bold"
                disabled={isDrawing || pathsHistoryRef.current.length === 0}
              >
                ✓ <span className="hidden md:inline">Verifica</span>
              </button>
            </div>

            {/* CSS Animation */}
            <style>{`
              /* Canvas sizing responsive */
              .canvas-wrapper {
                width: 65vw;
                max-width: 400px;
              }

              @media (min-width: 768px) {
                .canvas-wrapper {
                  width: 400px;
                }
              }

              @media (min-width: 1024px) {
                .canvas-wrapper {
                  width: 450px;
                  max-width: 450px;
                }
              }

              @keyframes stampAppear {
                0% {
                  transform: translate(-50%, -50%) scale(0) rotate(-15deg);
                  opacity: 0;
                }
                50% {
                  transform: translate(-50%, -50%) scale(1.2) rotate(-15deg);
                }
                100% {
                  transform: translate(-50%, -50%) scale(1) rotate(-15deg);
                  opacity: 1;
                }
              }

              @keyframes glitterPulse {
                0%, 100% {
                  transform: translate(-50%, -50%) scale(1);
                  opacity: 0.4;
                }
                50% {
                  transform: translate(-50%, -50%) scale(1.3);
                  opacity: 0.6;
                }
              }

              @keyframes particleFall {
                0% {
                  transform: translateY(0) rotate(0deg);
                  opacity: 1;
                }
                100% {
                  transform: translateY(200px) rotate(360deg);
                  opacity: 0;
                }
              }

              .particle {
                position: absolute;
                width: 8px;
                height: 8px;
                background: radial-gradient(circle, #E9B824, #FFC107);
                border-radius: 50%;
                animation: particleFall 2s ease-in infinite;
                box-shadow: 0 0 10px rgba(233,184,36,0.8);
              }

              .particle-1 { top: -10px; left: 20%; animation-delay: 0s; }
              .particle-2 { top: -10px; left: 40%; animation-delay: 0.3s; }
              .particle-3 { top: -10px; left: 60%; animation-delay: 0.6s; }
              .particle-4 { top: -10px; left: 80%; animation-delay: 0.9s; }
              .particle-5 { top: -10px; left: 30%; animation-delay: 1.2s; }
              .particle-6 { top: -10px; left: 70%; animation-delay: 1.5s; }
            `}</style>
          </div>

          {/* Info Panel */}
          <div className="card-wabi p-4 md:p-6 lg:flex-1">
            {currentKanji ? (
              <>
                {/* Kanji Display */}
                <div className="text-center mb-4 md:mb-8">
                  <div className="text-7xl md:text-9xl font-bold mb-2 md:mb-4 text-sumi font-mincho">
                    {currentKanji.kanji}
                  </div>
                  <div className="text-sm text-gray-500 mb-2">
                    {currentKanji.strokes} tratti
                  </div>
                </div>

                {/* Readings */}
                <div className="space-y-2 md:space-y-4 mb-4 md:mb-6">
                  <div className="p-3 rounded-lg bg-blue-50">
                    <div className="text-xs text-blue-600 font-semibold mb-1">音読み (Onyomi)</div>
                    <div className="text-lg font-bold text-blue-700 font-mincho">{currentKanji.onyomi}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-green-50">
                    <div className="text-xs text-green-600 font-semibold mb-1">訓読み (Kunyomi)</div>
                    <div className="text-lg font-bold text-green-700 font-mincho">{currentKanji.kunyomi || '—'}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-50">
                    <div className="text-xs text-purple-600 font-semibold mb-1">Significato</div>
                    <div className="text-xl font-bold text-purple-700">{currentKanji.meaning}</div>
                  </div>
                </div>

                {/* Examples */}
                {currentKanji.examples && currentKanji.examples.length > 0 && (
                  <div className="space-y-2 md:space-y-3 mb-4 md:mb-6">
                    <div className="text-xs text-gray-600 font-semibold">📝 Esempi</div>
                    {currentKanji.examples.slice(0, 3).map((ex, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="text-sm font-bold text-sumi font-mincho">
                          {ex.word} ({ex.reading})
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {ex.meaning}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Navigation */}
                <div className="grid grid-cols-2 gap-2 md:gap-3">
                  <button
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className="btn-minimal py-2 md:py-3 text-sm md:text-base font-semibold disabled:opacity-30"
                  >
                    ← Precedente
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={currentIndex === kanjiData.length - 1}
                    className="btn-minimal py-2 md:py-3 text-sm md:text-base font-semibold disabled:opacity-30"
                  >
                    Successivo →
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <div className="text-sumi text-lg">Caricamento kanji...</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
