import React, { useState, useRef, useEffect } from 'react';
import sentencesData from '../database/sentences.json';
import useSessionStats from '../hooks/useSessionStats';
import { evaluateMatch, MatchState } from '../utils/stringMatcher';
import { stripPhoneticMarkers } from '../utils/phoneticParser';
import AnnotatedText from '../components/AnnotatedText';
import SessionDashboard from '../components/SessionDashboard';
import TextDiff from '../components/TextDiff';
import LiveFeedbackInput from '../components/LiveFeedbackInput';

/**
 * DictationMaster - Audio dictation practice (Wabi-Sabi theme)
 */
export default function DictationMaster() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showStamp, setShowStamp] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hintSentence, setHintSentence] = useState(null);
  const [shuffledSentences, setShuffledSentences] = useState([]);
  const [failedSentences, setFailedSentences] = useState({});
  const [reviewMode, setReviewMode] = useState(false);
  const [matchResult, setMatchResult] = useState(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showTrickyTable, setShowTrickyTable] = useState(false);

  const { completedIds, completedCount, markCompleted, resetSession, isCompleted } = useSessionStats();
  const audioRef = useRef(null);

  // Load failed sentences
  useEffect(() => {
    const stored = localStorage.getItem('dictation-failed-sentences');
    if (stored) setFailedSentences(JSON.parse(stored));
  }, []);

  // Shuffle with SRS
  useEffect(() => {
    const applyWeightedShuffle = (sentences) => {
      if (reviewMode) {
        return sentences.filter(s => failedSentences[s.id]).sort(() => Math.random() - 0.5);
      }
      const weighted = [];
      sentences.forEach(sentence => {
        const failCount = failedSentences[sentence.id]?.count || 0;
        const repetitions = Math.min(failCount + 1, 3);
        for (let i = 0; i < repetitions; i++) {
          weighted.push(sentence);
        }
      });
      return weighted.sort(() => Math.random() - 0.5);
    };
    setShuffledSentences(applyWeightedShuffle(sentencesData));
  }, [failedSentences, reviewMode]);

  const currentSentence = shuffledSentences[currentIndex] || sentencesData[0];

  const handlePlay = () => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const togglePlaybackRate = () => {
    const newRate = playbackRate === 1 ? 0.85 : playbackRate === 0.85 ? 0.75 : 1;
    setPlaybackRate(newRate);
    if (audioRef.current) audioRef.current.playbackRate = newRate;
  };

  const normalize = (text) => text.trim().replace(/[。、！？!?,\.]/g, '');

  const handleInputChange = (e) => {
    const value = e.target.value;
    setUserInput(value);

    const targetReading = stripPhoneticMarkers(
      currentSentence.reading_annotated || currentSentence.reading
    );
    const matchEval = evaluateMatch(value, targetReading, {
      normalize: true,
      nearMissThreshold: 85
    });

    setMatchResult(matchEval);

    if (matchEval.state === MatchState.CORRECT || matchEval.state === MatchState.NEAR_MISS) {
      setShowStamp(true);
      markCompleted(currentSentence.id);

      // SRS: decrease fail count
      if (failedSentences[currentSentence.id]) {
        const newFailed = { ...failedSentences };
        const current = newFailed[currentSentence.id];
        const newCount = Math.max(0, (current.count || current) - 1);
        if (newCount === 0) {
          delete newFailed[currentSentence.id];
        } else {
          newFailed[currentSentence.id] = {
            count: newCount,
            lastFailed: current.lastFailed || Date.now()
          };
        }
        setFailedSentences(newFailed);
        localStorage.setItem('dictation-failed-sentences', JSON.stringify(newFailed));
      }
    }
  };

  const handleNext = () => {
    if (currentIndex < shuffledSentences.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setUserInput('');
      setShowStamp(false);
      setShowHint(false);
      setHintSentence(null);
      setMatchResult(null);
      handlePause();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setUserInput('');
      setShowStamp(false);
      setShowHint(false);
      setHintSentence(null);
      setMatchResult(null);
      handlePause();
    }
  };

  const handleReshuffle = () => {
    const weighted = [];
    sentencesData.forEach(sentence => {
      const failData = failedSentences[sentence.id];
      const failCount = failData?.count || 0;
      const repetitions = Math.min(failCount + 1, 3);
      for (let i = 0; i < repetitions; i++) {
        weighted.push(sentence);
      }
    });
    const shuffled = weighted.sort(() => Math.random() - 0.5);

    setShuffledSentences(shuffled);
    setCurrentIndex(0);
    setUserInput('');
    setShowStamp(false);
    setShowHint(false);
    setHintSentence(null);
    setMatchResult(null);
    resetSession();
    handlePause();
  };

  const toggleReviewMode = () => {
    setReviewMode(!reviewMode);
    setCurrentIndex(0);
    setUserInput('');
    setShowStamp(false);
    setShowHint(false);
    setHintSentence(null);
    setMatchResult(null);
    resetSession();
    handlePause();
  };

  const handleSkip = () => {
    setHintSentence(currentSentence);
    setUserInput(currentSentence.reading);
    setShowHint(true);

    const newFailed = { ...failedSentences };
    const current = newFailed[currentSentence.id];
    const currentCount = current?.count || current || 0;
    newFailed[currentSentence.id] = {
      count: currentCount + 1,
      lastFailed: Date.now()
    };
    setFailedSentences(newFailed);
    localStorage.setItem('dictation-failed-sentences', JSON.stringify(newFailed));
  };

  const uniqueCompletedCount = new Set(completedIds).size;
  const progressPercentage = Math.round((uniqueCompletedCount / sentencesData.length) * 100);

  return (
    <div className="min-h-screen bg-washi py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="card-wabi mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-sumi flex items-center gap-3">
              <span className="font-mincho">🎧</span>
              <span>Dictation Master</span>
            </h1>
            <div className="text-right">
              <div className="text-sm text-gray-500">Progress</div>
              <div className="text-2xl font-bold text-hinomaru">
                {uniqueCompletedCount} / {sentencesData.length}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-matcha to-bamboo transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={handleReshuffle}
                className="btn-minimal text-xs px-3 py-1.5"
              >
                🔀 Rimescola
              </button>

              <button
                onClick={() => setShowTrickyTable(!showTrickyTable)}
                className={`text-xs px-3 py-1.5 rounded transition-all ${
                  showTrickyTable ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'btn-minimal'
                }`}
              >
                👂 Suoni
              </button>

              <button
                onClick={() => setShowDashboard(!showDashboard)}
                className={`text-xs px-3 py-1.5 rounded transition-all ${
                  showDashboard ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'btn-minimal'
                }`}
              >
                📊 Stats
              </button>

              {Object.keys(failedSentences).length > 0 && (
                <button
                  onClick={toggleReviewMode}
                  className={`text-xs px-3 py-1.5 rounded transition-all ${
                    reviewMode ? 'bg-red-100 text-red-700 border border-red-300 font-semibold' : 'btn-minimal'
                  }`}
                >
                  {reviewMode ? '🔥 Modalità Ripasso ON' : '🔥 Modalità Ripasso'}
                </button>
              )}
            </div>

            {/* SRS Badge */}
            {Object.keys(failedSentences).length > 0 && (
              <div className="bg-orange-100 border border-orange-300 text-orange-700 text-xs px-3 py-1.5 rounded-full font-semibold">
                📌 {Object.keys(failedSentences).length} in SRS
              </div>
            )}
          </div>
        </div>

        {/* Main Card */}
        <div className="card-wabi relative">
          <audio
            ref={audioRef}
            src={`/audio/dictation/${currentSentence.id}.mp3`}
            onEnded={() => setIsPlaying(false)}
            preload="auto"
          />

          <div className="text-center mb-6 text-gray-500">
            <span className="text-sm font-medium">
              Frase {currentIndex + 1} / {shuffledSentences.length}
            </span>
          </div>

          {/* Controls */}
          <div className="flex gap-3 mb-8 justify-center">
            <button
              onClick={isPlaying ? handlePause : handlePlay}
              className="btn-accent px-8 py-3 text-lg font-semibold"
            >
              {isPlaying ? '⏸️ Pause' : '▶️ Play'}
            </button>
            <button
              onClick={togglePlaybackRate}
              className={`btn-minimal ${playbackRate < 1 ? 'bg-gray-100' : ''}`}
            >
              {playbackRate === 1 ? '🐇' : playbackRate === 0.85 ? '🚶' : '🐢'} {playbackRate}x
            </button>
          </div>

          {/* Input con feedback real-time */}
          <LiveFeedbackInput
            value={userInput}
            onChange={handleInputChange}
            target={stripPhoneticMarkers(
              currentSentence.reading_annotated || currentSentence.reading
            )}
            placeholder="ここに入力..."
            disabled={showStamp}
          />

          {/* Hint Button */}
          <div className="mt-4">
            <button
              onClick={handleSkip}
              className="btn-minimal text-sm"
              disabled={showHint}
            >
              {showHint ? '💡 Aiuto mostrato' : '💡 Mostra aiuto'}
            </button>
          </div>

          {/* Translations */}
          {(currentSentence.english || currentSentence.italian) && (
            <div className="mt-6 p-4 rounded-lg bg-gray-50">
              {currentSentence.english && (
                <div className="text-sm text-gray-600 mb-1">
                  🇬🇧 {currentSentence.english}
                </div>
              )}
              {currentSentence.italian && (
                <div className="text-sm text-gray-600">
                  🇮🇹 {currentSentence.italian}
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          {!showStamp && (
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="btn-minimal py-3 font-semibold disabled:opacity-30"
              >
                ← Precedente
              </button>
              <button
                onClick={handleNext}
                disabled={currentIndex === shuffledSentences.length - 1}
                className="btn-minimal py-3 font-semibold disabled:opacity-30"
              >
                Successiva →
              </button>
            </div>
          )}

          {/* Next Button (when completed) */}
          {showStamp && (
            <div className="mt-6">
              <button
                onClick={handleNext}
                disabled={currentIndex === shuffledSentences.length - 1}
                className="w-full btn-accent py-4 text-lg font-bold disabled:opacity-30"
              >
                {currentIndex === shuffledSentences.length - 1 ? '🏁 Fine' : '▶️ Avanti'}
              </button>
            </div>
          )}

          {/* Hanko Stamp */}
          {showStamp && (
            <div className="absolute top-8 right-8 stamp-animation">
              <div className="w-24 h-24 rounded-full border-4 border-hinomaru bg-white flex flex-col items-center justify-center shadow-hanko rotate-[-12deg]">
                <div className="text-3xl font-bold text-hinomaru font-mincho">
                  {matchResult?.state === MatchState.NEAR_MISS ? '良' : '合格'}
                </div>
                <div className="text-xs text-hinomaru mt-1">
                  {matchResult?.state === MatchState.NEAR_MISS ? 'Good!' : 'Perfect!'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Hint Section */}
        {showHint && hintSentence && (
          <div className="card-wabi mt-6 text-center">
            <div className="text-4xl font-bold mb-3 font-mincho">
              {hintSentence.japanese}
            </div>
            <div className="text-2xl text-sumi/70 font-mincho">
              {hintSentence.reading_annotated ? (
                <AnnotatedText
                  text={hintSentence.reading_annotated}
                />
              ) : (
                hintSentence.reading
              )}
            </div>
          </div>
        )}

        {/* Tricky Sounds Table */}
        {showTrickyTable && (
          <div className="card-wabi mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-sumi">
                👂 Suoni Ingannevoli
              </h3>
              <button
                onClick={() => setShowTrickyTable(false)}
                className="btn-minimal text-sm px-3 py-1"
              >
                ✕ Chiudi
              </button>
            </div>

            <div className="text-sm text-gray-600 mb-4">
              Suoni comuni che possono confondere l'orecchio durante il dettato.
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {/* G Nasale */}
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div className="font-semibold text-sumi mb-2">G Nasale (濁音鼻濁音)</div>
                <div className="text-xs text-gray-600 mb-2">La "G" tra vocali può suonare come "R" o "N"</div>
                <div className="grid grid-cols-5 gap-2 text-sm">
                  <div className="text-center"><span className="text-2xl font-mincho">が</span><br/><span className="text-xs text-gray-500">ra/na</span></div>
                  <div className="text-center"><span className="text-2xl font-mincho">ぎ</span><br/><span className="text-xs text-gray-500">ri/ni</span></div>
                  <div className="text-center"><span className="text-2xl font-mincho">ぐ</span><br/><span className="text-xs text-gray-500">ru/nu</span></div>
                  <div className="text-center"><span className="text-2xl font-mincho">げ</span><br/><span className="text-xs text-gray-500">re/ne</span></div>
                  <div className="text-center"><span className="text-2xl font-mincho">ご</span><br/><span className="text-xs text-gray-500">ro/no</span></div>
                </div>
              </div>

              {/* Tsu vs Su */}
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div className="font-semibold text-sumi mb-2">Tsu vs Su</div>
                <div className="text-xs text-gray-600 mb-2">つ (tsu) è diverso da す (su)</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-center"><span className="text-2xl font-mincho">つ</span><br/><span className="text-xs text-gray-500">tsu (con "t")</span></div>
                  <div className="text-center"><span className="text-2xl font-mincho">す</span><br/><span className="text-xs text-gray-500">su (pura "s")</span></div>
                </div>
              </div>

              {/* R giapponese */}
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div className="font-semibold text-sumi mb-2">R giapponese (flap)</div>
                <div className="text-xs text-gray-600 mb-2">Tra R, D e L</div>
                <div className="grid grid-cols-5 gap-2 text-sm">
                  <div className="text-center"><span className="text-2xl font-mincho">ら</span><br/><span className="text-xs text-gray-500">ra/da/la</span></div>
                  <div className="text-center"><span className="text-2xl font-mincho">り</span><br/><span className="text-xs text-gray-500">ri/di/li</span></div>
                  <div className="text-center"><span className="text-2xl font-mincho">る</span><br/><span className="text-xs text-gray-500">ru/du/lu</span></div>
                  <div className="text-center"><span className="text-2xl font-mincho">れ</span><br/><span className="text-xs text-gray-500">re/de/le</span></div>
                  <div className="text-center"><span className="text-2xl font-mincho">ろ</span><br/><span className="text-xs text-gray-500">ro/do/lo</span></div>
                </div>
              </div>

              {/* Shi vs Chi */}
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div className="font-semibold text-sumi mb-2">Shi vs Chi</div>
                <div className="text-xs text-gray-600 mb-2">し (shi) è diverso da ち (chi)</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-center"><span className="text-2xl font-mincho">し</span><br/><span className="text-xs text-gray-500">shi (sibilante)</span></div>
                  <div className="text-center"><span className="text-2xl font-mincho">ち</span><br/><span className="text-xs text-gray-500">chi (affricata)</span></div>
                </div>
              </div>

              {/* Piccolo Tsu */}
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div className="font-semibold text-sumi mb-2">Piccolo Tsu (促音)</div>
                <div className="text-xs text-gray-600 mb-2">っ raddoppia la consonante successiva (pausa breve)</div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center"><span className="text-xl font-mincho">がっこう</span><br/><span className="text-xs text-gray-500">gakkou (scuola)</span></div>
                  <div className="text-center"><span className="text-xl font-mincho">ずっと</span><br/><span className="text-xs text-gray-500">zutto (sempre)</span></div>
                  <div className="text-center"><span className="text-xl font-mincho">まって</span><br/><span className="text-xs text-gray-500">matte (aspetta)</span></div>
                </div>
              </div>

              {/* N sillabico */}
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div className="font-semibold text-sumi mb-2">N sillabico (撥音)</div>
                <div className="text-xs text-gray-600 mb-2">ん può suonare come "n", "m" o "ng"</div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center"><span className="text-xl font-mincho">さん</span><br/><span className="text-xs text-gray-500">san (sig./sig.ra)</span></div>
                  <div className="text-center"><span className="text-xl font-mincho">せんぱい</span><br/><span className="text-xs text-gray-500">senpai (sempai)</span></div>
                  <div className="text-center"><span className="text-xl font-mincho">ほん</span><br/><span className="text-xs text-gray-500">hon (libro)</span></div>
                </div>
              </div>

              {/* Wo vs O */}
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div className="font-semibold text-sumi mb-2">を (Wo) vs お (O)</div>
                <div className="text-xs text-gray-600 mb-2">を (particella oggetto) si pronuncia "o"</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-center"><span className="text-2xl font-mincho">を</span><br/><span className="text-xs text-gray-500">wo → o (particella)</span></div>
                  <div className="text-center"><span className="text-2xl font-mincho">お</span><br/><span className="text-xs text-gray-500">o (normale)</span></div>
                </div>
                <div className="mt-2 text-xs text-blue-600 bg-blue-50 p-2 rounded">
                  💡 Puoi scrivere sia "wo" che "o" per を - entrambi sono corretti!
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Session Dashboard */}
        {showDashboard && (
          <div className="mt-6">
            <SessionDashboard totalSentences={sentencesData.length} />
          </div>
        )}
      </div>
    </div>
  );
}
