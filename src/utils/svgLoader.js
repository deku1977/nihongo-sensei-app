/**
 * KanjiVG SVG Loader & Parser
 * Carica e processa i file SVG per estrarre coordinate path e metadata
 */

/**
 * Converte carattere kanji in unicode hex (formato KanjiVG)
 * @param {string} kanji - Carattere singolo
 * @returns {string} Hex code (es. "065e5" per 日)
 */
export function kanjiToHex(kanji) {
  return kanji.charCodeAt(0).toString(16).padStart(5, '0');
}

/**
 * Carica SVG da public/kanji (serviti staticamente)
 * @param {string} kanji - Carattere kanji
 * @returns {Promise<string>} SVG content
 */
export async function loadKanjiSVG(kanji) {
  const hex = kanjiToHex(kanji);
  // Path pubblico (servito da /public) - Vite serve /public come root
  const baseUrl = `/kanji/${hex}.svg`;
  // Cache busting per evitare cache browser durante test
  const url = `${baseUrl}?v=${Date.now()}`;

  console.log(`[svgLoader] Fetching SVG from: ${baseUrl}`);
  console.log(`[svgLoader] Full URL with cache busting: ${url}`);

  try {
    const response = await fetch(url);

    // Check HTTP status
    if (!response.ok) {
      const errorMsg = `Impossibile trovare il file ${baseUrl} nella cartella public/kanji/. ` +
                       `Status: ${response.status} ${response.statusText}. ` +
                       `Verifica che il file esista in: public/kanji/${hex}.svg`;
      throw new Error(errorMsg);
    }

    // Check Content-Type per evitare HTML 404 mascherato
    const contentType = response.headers.get('content-type');
    console.log(`[svgLoader] Content-Type: ${contentType}`);

    if (!contentType || !contentType.includes('svg')) {
      // Potrebbe essere HTML 404 mascherato da server
      const textPreview = await response.text();
      console.error(`[svgLoader] Invalid content-type for ${hex}.svg:`, {
        contentType,
        receivedLength: textPreview.length,
        preview: textPreview.substring(0, 300)
      });

      // Se riceve HTML, è probabilmente una pagina 404
      if (textPreview.includes('<html') || textPreview.includes('<!DOCTYPE')) {
        throw new Error(
          `Ricevuto HTML invece di SVG per ${baseUrl}. ` +
          `Il file non esiste in public/kanji/ o Vite config non corretto. ` +
          `Content-Type ricevuto: ${contentType || 'unknown'}`
        );
      }

      throw new Error(`File non trovato o formato errato (got: ${contentType || 'unknown'})`);
    }

    const svgContent = await response.text();

    // Validazione finale: verifica che sia XML valido
    if (!svgContent.includes('<svg') && !svgContent.includes('<?xml')) {
      console.error(`[svgLoader] Invalid SVG content:`, svgContent.substring(0, 200));
      throw new Error(`Contenuto non valido per ${hex}.svg (non è un file SVG)`);
    }

    console.log(`[svgLoader] ✅ SVG loaded successfully: ${svgContent.length} chars`);

    return svgContent;

  } catch (error) {
    console.error(`[svgLoader] ❌ Failed to load ${kanji} (${hex}):`, error.message);
    throw error;
  }
}

/**
 * Parser SVG - Estrae paths con ordine tratti (ROBUST VERSION)
 * @param {string} svgContent - XML SVG
 * @returns {Array<Object>} Array di {order, d, type}
 */
export function parseSVGPaths(svgContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');

  // Check for parsing errors
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    console.error('[Parser] SVG parsing error:', parserError.textContent);
    return [];
  }

  // Robust selectors - prova più strategie
  let paths = [];

  // Strategy 1: KanjiVG format standard (id="kvg:xxxxx-s1")
  paths = Array.from(doc.querySelectorAll('path[id*="-s"]'));
  console.log('[Parser] Strategy 1 (id*="-s"):', paths.length, 'paths');

  // Strategy 2: Fallback - tutti i path con id che inizia con "kvg:"
  if (paths.length === 0) {
    paths = Array.from(doc.querySelectorAll('path[id^="kvg:"]'));
    console.log('[Parser] Strategy 2 (id^="kvg:"):', paths.length, 'paths');
  }

  // Strategy 3: Fallback finale - tutti i path con attributo 'd'
  if (paths.length === 0) {
    paths = Array.from(doc.querySelectorAll('path[d]'));
    console.log('[Parser] Strategy 3 (all paths):', paths.length, 'paths');
  }

  console.log(`[Parser] Path trovati nell'SVG: ${paths.length}`);

  if (paths.length === 0) {
    console.warn('[Parser] Nessun path trovato nell\'SVG');
    return [];
  }

  const parsed = paths.map((path, fallbackIndex) => {
    const id = path.getAttribute('id') || '';
    const match = id.match(/-s(\d+)$/);
    // Se non c'è match, usa indice sequenziale + 1
    const order = match ? parseInt(match[1], 10) : (fallbackIndex + 1);
    const d = path.getAttribute('d') || '';

    if (!d) {
      console.warn('[Parser] Path senza attributo "d":', id);
    }

    return {
      order,
      d,
      type: path.getAttribute('kvg:type') || 'unknown',
      id: id || `path-${fallbackIndex}`
    };
  }).filter(p => p.d.length > 0) // Filtra path vuoti
    .sort((a, b) => a.order - b.order);

  console.log('[Parser] Path validi estratti:', parsed.length);
  console.log('[Parser] Path details:', parsed.map(p => ({ order: p.order, id: p.id, dLength: p.d.length })));

  return parsed;
}

/**
 * Converte SVG path 'd' in array di coordinate normalizzate (IMPROVED)
 * @param {string} pathD - SVG path data (es. "M10,20 L30,40")
 * @param {number} viewBoxSize - Dimensione viewBox SVG (default 109 per KanjiVG)
 * @param {number} targetSize - Dimensione canvas target (default 400)
 * @returns {Array<{x, y}>} Coordinate normalizzate
 */
export function pathToCoordinates(pathD, viewBoxSize = 109, targetSize = 400) {
  const scale = targetSize / viewBoxSize;
  const coords = [];

  if (!pathD || pathD.length === 0) {
    console.warn('[pathToCoordinates] Empty path data');
    return coords;
  }

  // Parser per comandi SVG path (supporta uppercase e lowercase)
  const commands = pathD.match(/[MLHVCSQTAZmlhvcsqtaz][^MLHVCSQTAZmlhvcsqtaz]*/g) || [];

  console.log(`[pathToCoordinates] Parsing ${commands.length} commands from path`);

  let currentX = 0;
  let currentY = 0;

  commands.forEach((cmd, idx) => {
    const type = cmd[0];
    const isRelative = type === type.toLowerCase();
    // Match numeri (positivi/negativi/decimali, inclusi .5 e 1.23e-4)
    const args = (cmd.slice(1).match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) || []).map(Number);

    if (args.some(isNaN)) {
      console.warn(`[pathToCoordinates] Invalid args in command ${idx}:`, cmd);
      return;
    }

    switch (type.toUpperCase()) {
      case 'M': // MoveTo
        if (isRelative && coords.length > 0) {
          currentX += args[0] * scale;
          currentY += args[1] * scale;
        } else {
          currentX = args[0] * scale;
          currentY = args[1] * scale;
        }
        coords.push({ x: currentX, y: currentY });
        break;

      case 'L': // LineTo
        if (isRelative) {
          currentX += args[0] * scale;
          currentY += args[1] * scale;
        } else {
          currentX = args[0] * scale;
          currentY = args[1] * scale;
        }
        coords.push({ x: currentX, y: currentY });
        break;

      case 'H': // Horizontal Line
        if (isRelative) {
          currentX += args[0] * scale;
        } else {
          currentX = args[0] * scale;
        }
        coords.push({ x: currentX, y: currentY });
        break;

      case 'V': // Vertical Line
        if (isRelative) {
          currentY += args[0] * scale;
        } else {
          currentY = args[0] * scale;
        }
        coords.push({ x: currentX, y: currentY });
        break;

      case 'C': // Cubic Bezier (aggiungi punti intermedi + finale)
        if (args.length >= 6) {
          // Punto controllo 1 (opzionale per matching)
          const cp1x = (isRelative ? currentX + args[0] * scale : args[0] * scale);
          const cp1y = (isRelative ? currentY + args[1] * scale : args[1] * scale);

          // Punto controllo 2
          const cp2x = (isRelative ? currentX + args[2] * scale : args[2] * scale);
          const cp2y = (isRelative ? currentY + args[3] * scale : args[3] * scale);

          // Punto finale
          const endX = (isRelative ? currentX + args[4] * scale : args[4] * scale);
          const endY = (isRelative ? currentY + args[5] * scale : args[5] * scale);

          // Aggiungi punti intermedi per migliorare matching
          coords.push({ x: cp1x, y: cp1y });
          coords.push({ x: cp2x, y: cp2y });
          coords.push({ x: endX, y: endY });

          currentX = endX;
          currentY = endY;
        }
        break;

      case 'S': // Smooth Cubic Bezier
        if (args.length >= 4) {
          const cp2x = (isRelative ? currentX + args[0] * scale : args[0] * scale);
          const cp2y = (isRelative ? currentY + args[1] * scale : args[1] * scale);
          const endX = (isRelative ? currentX + args[2] * scale : args[2] * scale);
          const endY = (isRelative ? currentY + args[3] * scale : args[3] * scale);

          coords.push({ x: cp2x, y: cp2y });
          coords.push({ x: endX, y: endY });

          currentX = endX;
          currentY = endY;
        }
        break;

      case 'Q': // Quadratic Bezier
        if (args.length >= 4) {
          const cpx = (isRelative ? currentX + args[0] * scale : args[0] * scale);
          const cpy = (isRelative ? currentY + args[1] * scale : args[1] * scale);
          const endX = (isRelative ? currentX + args[2] * scale : args[2] * scale);
          const endY = (isRelative ? currentY + args[3] * scale : args[3] * scale);

          coords.push({ x: cpx, y: cpy });
          coords.push({ x: endX, y: endY });

          currentX = endX;
          currentY = endY;
        }
        break;

      case 'Z': // ClosePath
        // Non aggiungere coordinate, solo chiudi il path
        break;
    }
  });

  console.log(`[pathToCoordinates] Extracted ${coords.length} coordinates (scaled ${viewBoxSize}→${targetSize})`);

  return coords;
}

/**
 * Estrae viewBox da SVG
 * @param {string} svgContent - XML SVG
 * @returns {{width: number, height: number}}
 */
export function extractViewBox(svgContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');
  const svg = doc.querySelector('svg');

  if (!svg) {
    console.warn('[extractViewBox] No SVG element found, using default 109x109');
    return { width: 109, height: 109 };
  }

  const viewBox = svg.getAttribute('viewBox');

  if (viewBox) {
    const parts = viewBox.split(/\s+/);
    if (parts.length === 4) {
      return {
        width: parseFloat(parts[2]),
        height: parseFloat(parts[3])
      };
    }
  }

  // Fallback to width/height attributes
  const width = svg.getAttribute('width');
  const height = svg.getAttribute('height');

  if (width && height) {
    return {
      width: parseFloat(width),
      height: parseFloat(height)
    };
  }

  console.warn('[extractViewBox] No viewBox or dimensions found, using default 109x109');
  return { width: 109, height: 109 };
}

/**
 * Estrae stroke hints da SVG (numeri d'ordine tratti)
 * Prova prima a leggere <text> da StrokeNumbers, poi fallback ai path
 * @param {string} svgContent - XML SVG completo
 * @param {Array<Object>} paths - Output di parseSVGPaths (fallback)
 * @param {number} viewBoxSize - Dimensione viewBox
 * @param {number} targetSize - Dimensione canvas (CSS pixels, NON canvas.width)
 * @returns {Array<{order, x, y}>}
 */
export function extractStrokeHints(svgContent, paths, viewBoxSize = 109, targetSize = 400) {
  const scale = targetSize / viewBoxSize;
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');

  // Strategy 1: Leggi <text> da gruppo StrokeNumbers (più preciso)
  const textElements = Array.from(doc.querySelectorAll('[id*="StrokeNumbers"] text'));

  if (textElements.length > 0) {
    console.log(`[extractStrokeHints] Strategy 1: Trovati ${textElements.length} text elements`);

    const hints = textElements.map((textEl, idx) => {
      const transform = textEl.getAttribute('transform');
      const orderText = textEl.textContent.trim();
      const order = parseInt(orderText, 10) || (idx + 1);

      // Parse transform matrix(a b c d e f) - e,f sono x,y
      const matrixMatch = transform?.match(/matrix\(([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\)/);

      if (matrixMatch) {
        const x = parseFloat(matrixMatch[5]) * scale;
        const y = parseFloat(matrixMatch[6]) * scale;
        return { order, x, y };
      }

      // Fallback: parse translate(x,y) o altre forme
      const translateMatch = transform?.match(/translate\(([-\d.]+)[,\s]+([-\d.]+)\)/);
      if (translateMatch) {
        const x = parseFloat(translateMatch[1]) * scale;
        const y = parseFloat(translateMatch[2]) * scale;
        return { order, x, y };
      }

      return { order, x: 0, y: 0 };
    });

    return hints;
  }

  // Strategy 2: Fallback - estrai primo punto M da ogni path
  console.log('[extractStrokeHints] Strategy 2: Fallback ai path');

  return paths.map(path => {
    const firstMove = path.d.match(/M\s*([-\d.]+)[,\s]+([-\d.]+)/i);

    if (!firstMove) {
      return { order: path.order, x: 0, y: 0 };
    }

    return {
      order: path.order,
      x: parseFloat(firstMove[1]) * scale,
      y: parseFloat(firstMove[2]) * scale
    };
  });
}

/**
 * Carica e processa kanji completo (wrapper con validazione completa)
 * @param {string} kanji - Carattere kanji
 * @returns {Promise<Object>} {paths, coordinates, hints, viewBox}
 */
export async function loadKanjiData(kanji) {
  console.log(`\n[LoadKanjiData] ===== Caricamento ${kanji} =====`);

  try {
    // Step 1: Carica SVG
    console.log('[LoadKanjiData] Step 1: Caricamento SVG...');
    const svgContent = await loadKanjiSVG(kanji);
    console.log(`[LoadKanjiData] SVG caricato, length: ${svgContent.length} chars`);

    // Step 1b: Estrai viewBox
    const viewBox = extractViewBox(svgContent);
    console.log('[LoadKanjiData] ViewBox estratta:', viewBox);

    // Step 2: Parsing paths
    console.log('[LoadKanjiData] Step 2: Parsing SVG paths...');
    const paths = parseSVGPaths(svgContent);

    if (paths.length === 0) {
      console.error('[LoadKanjiData] ❌ Nessun path estratto dall\'SVG!');
      throw new Error('SVG parsing failed: no paths found');
    }

    console.log(`[LoadKanjiData] ✅ Estratti ${paths.length} paths`);

    // Step 3: Conversione coordinate (usa viewBox dinamica)
    console.log('[LoadKanjiData] Step 3: Conversione coordinate...');
    const coordinates = paths.map((path, idx) => {
      const points = pathToCoordinates(path.d, viewBox.width, 400);

      if (points.length === 0) {
        console.warn(`[LoadKanjiData] ⚠️ Path ${idx} ha 0 punti (d="${path.d.substring(0, 50)}...")`);
      }

      return {
        order: path.order,
        points
      };
    });

    // Filtra paths senza punti
    const validCoordinates = coordinates.filter(c => c.points.length > 0);

    if (validCoordinates.length === 0) {
      console.error('[LoadKanjiData] ❌ Nessuna coordinata valida estratta!');
      throw new Error('Coordinate extraction failed: all paths empty');
    }

    console.log(`[LoadKanjiData] ✅ ${validCoordinates.length}/${coordinates.length} paths con coordinate valide`);

    // Step 4: Estrazione hints (usa viewBox dinamica, target = CSS pixels 400)
    console.log('[LoadKanjiData] Step 4: Estrazione stroke hints...');
    const hints = extractStrokeHints(svgContent, paths, viewBox.width, 400);
    console.log(`[LoadKanjiData] ✅ Estratti ${hints.length} hints`);

    // Final result
    const result = {
      kanji,
      paths,
      coordinates: validCoordinates,
      hints,
      viewBox
    };

    console.log('[LoadKanjiData] ===== SUCCESSO =====');
    console.log(`[LoadKanjiData] Summary:`, {
      kanji: result.kanji,
      pathsCount: result.paths.length,
      coordinatesCount: result.coordinates.length,
      hintsCount: result.hints.length,
      viewBox: result.viewBox,
      avgPointsPerStroke: Math.round(
        result.coordinates.reduce((sum, c) => sum + c.points.length, 0) / result.coordinates.length
      )
    });

    return result;

  } catch (error) {
    console.warn(`[LoadKanjiData] ⚠️ SVG non disponibile per ${kanji} (${kanjiToHex(kanji)}.svg)`);
    console.warn('[LoadKanjiData] Fallback: Utilizzando kanji con font standard');

    // FALLBACK: Ritorna struttura minima che permette funzionamento con font
    return {
      kanji,
      paths: [],
      coordinates: [],
      hints: [],
      fallback: true, // Flag che indica fallback mode
      fallbackReason: error.message
    };
  }
}
