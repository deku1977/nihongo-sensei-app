/**
 * Vector Matching Engine
 * Confronta tratti disegnati con coordinate SVG ideali
 */

/**
 * Calcola distanza euclidea tra due punti
 */
function distance(p1, p2) {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

/**
 * Calcola vettore direzione normalizzato
 */
function getDirection(points) {
  if (points.length < 2) return { dx: 0, dy: 0 };

  const start = points[0];
  const end = points[points.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  return len > 0 ? { dx: dx / len, dy: dy / len } : { dx: 0, dy: 0 };
}

/**
 * Calcola bounding box di un path
 */
function getBBox(points) {
  if (points.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, centerX: 0, centerY: 0 };
  }

  const bbox = points.reduce(
    (acc, p) => ({
      minX: Math.min(acc.minX, p.x),
      maxX: Math.max(acc.maxX, p.x),
      minY: Math.min(acc.minY, p.y),
      maxY: Math.max(acc.maxY, p.y)
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  );

  bbox.centerX = (bbox.minX + bbox.maxX) / 2;
  bbox.centerY = (bbox.minY + bbox.maxY) / 2;

  return bbox;
}

/**
 * Confronta similarità tra due tratti (disegnato vs ideale)
 * @param {Array<{x,y}>} drawnPath - Tratto disegnato dall'utente
 * @param {Array<{x,y}>} idealPath - Tratto ideale SVG
 * @returns {number} Score 0-100
 */
export function compareStrokes(drawnPath, idealPath) {
  if (drawnPath.length < 2 || idealPath.length < 2) {
    return 0;
  }

  const drawnDir = getDirection(drawnPath);
  const idealDir = getDirection(idealPath);

  const drawnBBox = getBBox(drawnPath);
  const idealBBox = getBBox(idealPath);

  // 1. Similarità direzione (dot product)
  const dotProduct = drawnDir.dx * idealDir.dx + drawnDir.dy * idealDir.dy;
  const directionScore = Math.max(0, dotProduct) * 100; // 0-100

  // 2. Similarità posizione (distanza centri)
  const centerDist = distance(
    { x: drawnBBox.centerX, y: drawnBBox.centerY },
    { x: idealBBox.centerX, y: idealBBox.centerY }
  );

  // Normalizza: 0 dist = 100, 200px dist = 0 (human-friendly tolerance)
  const positionScore = Math.max(0, 100 - (centerDist / 2));

  // 3. Similarità lunghezza
  const drawnLength = distance(drawnPath[0], drawnPath[drawnPath.length - 1]);
  const idealLength = distance(idealPath[0], idealPath[idealPath.length - 1]);

  const lengthRatio = Math.min(drawnLength, idealLength) / Math.max(drawnLength, idealLength);
  const lengthScore = lengthRatio * 100;

  // Score combinato (pesi: direzione 40%, posizione 40%, lunghezza 20%)
  const finalScore = directionScore * 0.4 + positionScore * 0.4 + lengthScore * 0.2;

  return Math.round(finalScore);
}

/**
 * Strict Stroke Order Validation
 * Valida che i tratti siano stati disegnati nell'ordine corretto
 * @param {Array<Array<{x,y}>>} drawnStrokes - Tratti disegnati (in ordine temporale)
 * @param {Array<{order, points}>} idealStrokes - Tratti ideali SVG
 * @returns {Object} {isValid, matches, details}
 */
export function validateStrokeOrder(drawnStrokes, idealStrokes) {
  if (drawnStrokes.length !== idealStrokes.length) {
    return {
      isValid: false,
      correctCount: 0,
      totalExpected: idealStrokes.length,
      message: `Numero tratti errato: ${drawnStrokes.length}/${idealStrokes.length}`
    };
  }

  const matches = [];
  let correctCount = 0;

  for (let i = 0; i < drawnStrokes.length; i++) {
    const drawn = drawnStrokes[i];
    const ideal = idealStrokes[i].points;

    const similarity = compareStrokes(drawn, ideal);
    const isCorrect = similarity >= 40; // Soglia 40% (human-friendly)

    matches.push({
      strokeIndex: i + 1,
      expectedOrder: idealStrokes[i].order,
      similarity,
      isCorrect
    });

    if (isCorrect) {
      correctCount++;
    }
  }

  const isValid = correctCount === idealStrokes.length;

  return {
    isValid,
    correctCount,
    totalExpected: idealStrokes.length,
    matches,
    message: isValid
      ? '✓ Ordine tratti corretto!'
      : `✗ ${correctCount}/${idealStrokes.length} tratti corretti`
  };
}

/**
 * Calcola score complessivo del kanji (nuova valutazione v2)
 * @param {Array<Array<{x,y}>>} drawnStrokes - Tratti disegnati
 * @param {Array<{order, points}>} idealStrokes - Tratti ideali SVG
 * @returns {Object} {score, breakdown, orderValidation}
 */
export function evaluateKanji(drawnStrokes, idealStrokes) {
  // Guard clauses - Validazione input
  if (!drawnStrokes || !Array.isArray(drawnStrokes) || drawnStrokes.length === 0) {
    console.warn('[VectorMatcher] Invalid drawnStrokes:', drawnStrokes);
    return {
      score: 0,
      breakdown: { avgSimilarity: 0, orderPenalty: 0, correctStrokes: 0, totalStrokes: 0 },
      orderValidation: { isValid: false, correctCount: 0, totalExpected: 0, matches: [], message: 'Nessun tratto disegnato' },
      passed: false
    };
  }

  if (!idealStrokes || !Array.isArray(idealStrokes) || idealStrokes.length === 0) {
    console.warn('[VectorMatcher] Invalid idealStrokes:', idealStrokes);
    return {
      score: 0,
      breakdown: { avgSimilarity: 0, orderPenalty: 0, correctStrokes: 0, totalStrokes: 0 },
      orderValidation: { isValid: false, correctCount: 0, totalExpected: 0, matches: [], message: 'Dati SVG non disponibili' },
      passed: false
    };
  }

  // 1. Validazione ordine tratti
  const orderValidation = validateStrokeOrder(drawnStrokes, idealStrokes);

  // 2. Score medio similarità geometrica
  const similarities = (orderValidation.matches || []).map(m => m.similarity);
  const avgSimilarity = similarities.length > 0
    ? similarities.reduce((sum, s) => sum + s, 0) / similarities.length
    : 0;

  // 3. Penalty per ordine errato (ridotta per essere più gentile)
  const orderPenalty = orderValidation.isValid ? 0 : 10;

  // Score finale (max 100)
  const finalScore = Math.max(0, Math.round(avgSimilarity - orderPenalty));

  return {
    score: finalScore,
    breakdown: {
      avgSimilarity: Math.round(avgSimilarity),
      orderPenalty,
      correctStrokes: orderValidation.correctCount,
      totalStrokes: orderValidation.totalExpected
    },
    orderValidation,
    passed: finalScore >= 60 // Soglia più umana (era 70)
  };
}

/**
 * Trova il miglior match per un tratto disegnato (fuzzy matching)
 * Utile quando l'ordine non è stretto
 * @param {Array<{x,y}>} drawnStroke - Singolo tratto disegnato
 * @param {Array<{order, points}>} idealStrokes - Tutti i tratti ideali
 * @param {Array<number>} usedIndices - Indici già matchati
 * @returns {Object} {bestIndex, similarity}
 */
export function findBestMatch(drawnStroke, idealStrokes, usedIndices = []) {
  let bestIndex = -1;
  let bestSimilarity = 0;

  idealStrokes.forEach((ideal, index) => {
    if (usedIndices.includes(index)) return;

    const similarity = compareStrokes(drawnStroke, ideal.points);

    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestIndex = index;
    }
  });

  return { bestIndex, similarity: bestSimilarity };
}
