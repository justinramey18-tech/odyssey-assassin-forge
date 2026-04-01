import React, { useState, useEffect, useCallback, useRef } from 'react';
import { rollWeightedDie, loadDiceOddsMode } from '@/lib/diceOdds';

interface DeathSaveScreenProps {
  open: boolean;
  characterName: string;
  dragonName: string;
  onStabilize: () => void;
  onDeath: () => void;
}

type Phase = 'blackout' | 'intro' | 'rolls' | 'stabilize' | 'death';

const INTRO_LINES: { text: string; style: string }[] = [
  { text: 'You failed to ground.', style: 'italic text-[#e8e0d4] text-xl' },
  { text: 'The fire consumed what it could not contain.', style: 'italic text-[#e8e0d4] text-xl' },
  { text: 'Your body hits the earth.', style: 'italic text-[#e8e0d4] text-xl' },
  { text: 'HP HAS REACHED ZERO.', style: 'uppercase font-mono text-[#c94444] text-sm tracking-[0.3em]' },
];

const SUCCESS_LINES = [
  'You cling to the edge.',
  'Something holds you here.',
  'Not yet. Not yet.',
  'A thread of warmth pulls taut.',
  'You hear a voice — distant, desperate.',
  'Your fingers find purchase in the dark.',
];

const FAILURE_LINES = [
  'You slip further.',
  'The silence deepens.',
  'The cold spreads.',
  'The thread frays.',
  'The voice fades.',
  'The dark welcomes you.',
];

const DeathSaveScreen: React.FC<DeathSaveScreenProps> = ({
  open,
  characterName,
  dragonName,
  onStabilize,
  onDeath,
}) => {
  const [phase, setPhase] = useState<Phase>('blackout');
  const [introIndex, setIntroIndex] = useState(0);
  const [introVisible, setIntroVisible] = useState(false);
  const [successes, setSuccesses] = useState(0);
  const [failures, setFailures] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [displayNumber, setDisplayNumber] = useState<number | null>(null);
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [flavorText, setFlavorText] = useState('');
  const [rollHistory, setRollHistory] = useState<{ value: number; success: boolean }[]>([]);

  // Stabilize sub-phases
  const [stabPhase, setStabPhase] = useState(0);
  const [stabFade, setStabFade] = useState(false);
  const [roarWords, setRoarWords] = useState<number>(0);
  const [followWords, setFollowWords] = useState<number>(0);
  const [tunnelScale, setTunnelScale] = useState(0);
  const [showRestoredText, setShowRestoredText] = useState(false);
  const [waitingForTap, setWaitingForTap] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const successCountRef = useRef(0);
  const failureCountRef = useRef(0);

  // Preload audio
  useEffect(() => {
    try {
      const audio = new Audio('/audio/dragon-roar.mp3');
      audio.preload = 'auto';
      audioRef.current = audio;
    } catch { /* ignore */ }
  }, []);

  // Reset on open
  useEffect(() => {
    if (open) {
      setPhase('blackout');
      setIntroIndex(0);
      setIntroVisible(false);
      setSuccesses(0);
      setFailures(0);
      successCountRef.current = 0;
      failureCountRef.current = 0;
      setRolling(false);
      setDisplayNumber(null);
      setLastRoll(null);
      setFlavorText('');
      setRollHistory([]);
      setStabPhase(0);
      setStabFade(false);
      setRoarWords(0);
      setFollowWords(0);
      setTunnelScale(0);
      setShowRestoredText(false);
      setWaitingForTap(false);

      const t = setTimeout(() => setPhase('intro'), 1800);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Intro line auto-advance
  useEffect(() => {
    if (phase !== 'intro') return;
    setIntroVisible(true);
    const holdTimer = setTimeout(() => {
      setIntroVisible(false);
      const nextTimer = setTimeout(() => {
        if (introIndex < INTRO_LINES.length - 1) {
          setIntroIndex(prev => prev + 1);
        } else {
          setPhase('rolls');
        }
      }, 600);
      return () => clearTimeout(nextTimer);
    }, 2200);
    return () => clearTimeout(holdTimer);
  }, [phase, introIndex]);

  const skipIntro = useCallback(() => {
    if (phase !== 'intro') return;
    setIntroVisible(false);
    setTimeout(() => {
      if (introIndex < INTRO_LINES.length - 1) {
        setIntroIndex(prev => prev + 1);
      } else {
        setPhase('rolls');
      }
    }, 150);
  }, [phase, introIndex]);

  // Roll handler
  const handleRoll = useCallback(() => {
    if (rolling) return;
    setRolling(true);
    setFlavorText('');
    setLastRoll(null);

    // Tumbling animation
    let count = 0;
    const maxTicks = 18;
    const interval = setInterval(() => {
      setDisplayNumber(Math.floor(Math.random() * 20) + 1);
      count++;
      if (count >= maxTicks) {
        clearInterval(interval);
        const finalRoll = rollWeightedDie(20, loadDiceOddsMode());
        setDisplayNumber(finalRoll);
        setLastRoll(finalRoll);

        let newSuccesses = successCountRef.current;
        let newFailures = failureCountRef.current;
        let isSuccess = false;

        if (finalRoll === 20) {
          // Nat 20 → instant stabilize
          setFlavorText('Light breaks through. You gasp awake.');
          setRollHistory(prev => [...prev, { value: 20, success: true }]);
          setTimeout(() => {
            setPhase('stabilize');
          }, 1800);
          setRolling(false);
          return;
        } else if (finalRoll === 1) {
          // Nat 1 → 2 failures
          newFailures += 2;
          isSuccess = false;
          setFlavorText('The darkness doubles its grip.');
        } else if (finalRoll >= 10) {
          newSuccesses += 1;
          isSuccess = true;
          setFlavorText(SUCCESS_LINES[Math.min(newSuccesses - 1, SUCCESS_LINES.length - 1)]);
        } else {
          newFailures += 1;
          isSuccess = false;
          setFlavorText(FAILURE_LINES[Math.min(newFailures - 1, FAILURE_LINES.length - 1)]);
        }

        successCountRef.current = newSuccesses;
        failureCountRef.current = newFailures;
        setSuccesses(newSuccesses);
        setFailures(newFailures);
        setRollHistory(prev => [...prev, { value: finalRoll, success: isSuccess }]);

        if (newSuccesses >= 3) {
          setTimeout(() => setPhase('stabilize'), 1800);
        } else if (newFailures >= 3) {
          setTimeout(() => setPhase('death'), 1800);
        }

        setTimeout(() => setRolling(false), 800);
      }
    }, 70);
  }, [rolling]);

  // Stabilize sequence
  const ROAR_LINE = ['Your', 'dragon', 'ROARS', 'in', 'absolute', 'denial'];
  const FOLLOW_LINE = ['you', 'follow', 'the', 'sound'];

  useEffect(() => {
    if (phase !== 'stabilize') return;
    setStabPhase(0);
    setStabFade(false);
    setRoarWords(0);
    setFollowWords(0);
    setTunnelScale(0);
    setShowRestoredText(false);
    setWaitingForTap(true);
  }, [phase]);

  const startStabilizeSequence = useCallback(() => {
    setWaitingForTap(false);
    // Play audio
    if (audioRef.current) {
      try { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}); } catch { /* */ }
    }
    // Phase 0: word-by-word roar line
    setStabPhase(0);
    let wordIdx = 0;
    const wordTimer = setInterval(() => {
      wordIdx++;
      setRoarWords(wordIdx);
      if (wordIdx >= ROAR_LINE.length) {
        clearInterval(wordTimer);
        // Hold, then fade
        setTimeout(() => {
          setStabFade(true);
          setTimeout(() => {
            setStabPhase(1);
            setStabFade(false);
            // Phase 1: "you follow the sound"
            let fIdx = 0;
            const fTimer = setInterval(() => {
              fIdx++;
              setFollowWords(fIdx);
              if (fIdx >= FOLLOW_LINE.length) {
                clearInterval(fTimer);
                setTimeout(() => {
                  setStabFade(true);
                  setTimeout(() => {
                    setStabPhase(2);
                    setStabFade(false);
                    // Phase 2: tunnel of light
                    let t = 0;
                    const tunnelTimer = setInterval(() => {
                      t += 0.02;
                      // Accelerating expansion
                      const eased = t * t * t;
                      setTunnelScale(Math.min(1, eased * 8));
                      if (t >= 1) {
                        clearInterval(tunnelTimer);
                        setStabPhase(3);
                        setTimeout(() => setShowRestoredText(true), 1500);
                        setTimeout(() => onStabilize(), 3500);
                      }
                    }, 50);
                  }, 800);
                }, 1800);
              }
            }, 280);
          }, 800);
        }, 1800);
      }
    }, wordIdx === 0 ? 400 : 280);
  }, [onStabilize]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 9999, backgroundColor: '#0a0908' }}
    >
      {/* Phase 1: Blackout with ember */}
      {phase === 'blackout' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: '#c94444',
              boxShadow: '0 0 12px 4px rgba(201,68,68,0.5), 0 0 30px 8px rgba(201,68,68,0.2)',
              animation: 'ember-pulse 1.2s ease-in-out infinite',
            }}
          />
        </div>
      )}

      {/* Phase 2: Intro lines */}
      {phase === 'intro' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8">
          <div
            className={`font-cinzel text-center transition-opacity duration-500 ${
              introVisible ? 'opacity-100' : 'opacity-0'
            } ${INTRO_LINES[introIndex].style}`}
          >
            {INTRO_LINES[introIndex].text}
          </div>
          <button
            onClick={skipIntro}
            className="mt-8 text-[#6b5c4d] text-xs font-cinzel tracking-wider hover:text-[#e8e0d4] transition-colors"
          >
            Next ›
          </button>
        </div>
      )}

      {/* Phase 3: Death Save Rolls */}
      {phase === 'rolls' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 gap-6">
          {/* Header */}
          <h2
            className="font-cinzel tracking-[0.25em] text-[#e8e0d4] text-sm uppercase"
            style={{ fontVariant: 'small-caps' }}
          >
            Death Saves
          </h2>

          {/* Pip rows */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="font-cinzel text-xs text-[#7ab36a]/70 w-10 text-right">Hold</span>
              <div className="flex gap-2">
                {[0, 1, 2].map(i => (
                  <div
                    key={`s${i}`}
                    className="w-5 h-5 rounded-full border-2 transition-all duration-500"
                    style={{
                      borderColor: i < successes ? '#7ab36a' : '#3a322a',
                      backgroundColor: i < successes ? '#7ab36a' : 'transparent',
                      boxShadow: i < successes ? '0 0 8px rgba(122,179,106,0.5)' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-cinzel text-xs text-[#c94444]/70 w-10 text-right">Slip</span>
              <div className="flex gap-2">
                {[0, 1, 2].map(i => (
                  <div
                    key={`f${i}`}
                    className="w-5 h-5 rounded-full border-2 transition-all duration-500"
                    style={{
                      borderColor: i < failures ? '#c94444' : '#3a322a',
                      backgroundColor: i < failures ? '#c94444' : 'transparent',
                      boxShadow: i < failures ? '0 0 8px rgba(201,68,68,0.5)' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Roll display */}
          <div className="h-24 flex items-center justify-center">
            {displayNumber !== null && (
              <span
                className={`font-cinzel font-bold text-6xl transition-all duration-200 ${
                  lastRoll === 20
                    ? 'text-[#d4af37] drop-shadow-[0_0_20px_rgba(212,175,55,0.7)]'
                    : lastRoll === 1
                      ? 'text-[#c94444] drop-shadow-[0_0_20px_rgba(201,68,68,0.6)]'
                      : lastRoll !== null && lastRoll >= 10
                        ? 'text-[#7ab36a]'
                        : lastRoll !== null
                          ? 'text-[#c94444]'
                          : 'text-[#e8e0d4]/50'
                }`}
                style={{
                  animation: rolling ? 'tumble-number 0.1s linear infinite' : undefined,
                }}
              >
                {displayNumber}
              </span>
            )}
          </div>

          {/* Roll button */}
          {successes < 3 && failures < 3 && (
            <button
              onClick={handleRoll}
              disabled={rolling}
              className="min-h-[48px] px-8 py-3 rounded-full font-cinzel font-bold text-base tracking-wider uppercase
                border transition-all duration-200 active:scale-95 disabled:opacity-40"
              style={{
                backgroundColor: rolling ? '#3a322a' : '#4a3f35',
                borderColor: '#6b5c4d',
                color: '#e8e0d4',
                boxShadow: rolling ? 'none' : '0 0 15px rgba(201,68,68,0.2)',
                animation: rolling ? 'none' : 'save-pulse 2.5s ease-in-out infinite',
              }}
            >
              ⚄ Roll Death Save
            </button>
          )}

          {/* Flavor text */}
          {flavorText && (
            <p className="font-cinzel italic text-sm text-[#e8e0d4]/60 text-center max-w-[280px] animate-[fade-in_0.5s_ease-out]">
              {flavorText}
            </p>
          )}

          {/* Roll history */}
          {rollHistory.length > 0 && (
            <div className="flex gap-2 mt-2">
              {rollHistory.map((r, i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold font-cinzel"
                  style={{
                    backgroundColor: r.value === 20 ? '#d4af37' : r.success ? '#7ab36a' : '#c94444',
                    color: '#0a0908',
                    opacity: 0.8,
                  }}
                >
                  {r.value}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Phase 4a: Stabilize */}
      {phase === 'stabilize' && (
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Tap to begin */}
          {waitingForTap && (
            <button
              onClick={startStabilizeSequence}
              className="font-cinzel text-[#6b5c4d] text-sm tracking-wider animate-pulse"
            >
              Tap to continue
            </button>
          )}

          {/* Roar line */}
          {!waitingForTap && stabPhase === 0 && (
            <div
              className={`flex flex-wrap justify-center gap-x-2 gap-y-1 px-8 transition-opacity duration-700 ${
                stabFade ? 'opacity-0' : 'opacity-100'
              }`}
            >
              {ROAR_LINE.map((word, i) => (
                <span
                  key={i}
                  className={`font-cinzel ${
                    word === 'ROARS'
                      ? 'text-[32px] font-bold'
                      : 'text-[22px] italic'
                  }`}
                  style={{
                    color: word === 'ROARS' ? '#c94444' : '#e8e0d4',
                    opacity: i < roarWords ? 1 : 0,
                    transform: i < roarWords ? 'translateX(0)' : 'translateX(-8px)',
                    transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
                    animation: word === 'ROARS' && i < roarWords ? 'roar-vibrate 0.15s linear infinite' : undefined,
                    textShadow: word === 'ROARS' ? '0 0 20px rgba(201,68,68,0.6)' : undefined,
                  }}
                >
                  {word}
                </span>
              ))}
            </div>
          )}

          {/* Follow line */}
          {!waitingForTap && stabPhase === 1 && (
            <div
              className={`flex flex-wrap justify-center gap-x-2 px-8 transition-opacity duration-700 ${
                stabFade ? 'opacity-0' : 'opacity-100'
              }`}
            >
              {FOLLOW_LINE.map((word, i) => (
                <span
                  key={i}
                  className="font-cinzel italic text-[22px]"
                  style={{
                    color: '#e8e0d4',
                    opacity: i < followWords ? 1 : 0,
                    transform: i < followWords ? 'translateX(0)' : 'translateX(-8px)',
                    transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
                  }}
                >
                  {word}
                </span>
              ))}
            </div>
          )}

          {/* Tunnel of light */}
          {!waitingForTap && stabPhase === 2 && (
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at center, 
                  rgba(255,255,255,${tunnelScale * 0.95}) 0%, 
                  rgba(255,255,255,${tunnelScale * 0.7}) ${tunnelScale * 30}%, 
                  rgba(255,255,255,${tunnelScale * 0.3}) ${tunnelScale * 60}%, 
                  transparent ${tunnelScale * 90}%)`,
                transition: 'background 0.05s linear',
              }}
            >
              {/* Concentric rings */}
              {[0.2, 0.4, 0.6, 0.8].map((ring, i) => (
                tunnelScale > ring && (
                  <div
                    key={i}
                    className="absolute rounded-full border"
                    style={{
                      borderColor: `rgba(255,255,255,${(tunnelScale - ring) * 0.3})`,
                      width: `${ring * tunnelScale * 100}%`,
                      height: `${ring * tunnelScale * 100}%`,
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                )
              ))}
            </div>
          )}

          {/* Full white + restored text */}
          {!waitingForTap && stabPhase === 3 && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: '#ffffff' }}>
              {showRestoredText && (
                <span
                  className="font-cinzel text-lg tracking-[0.2em] uppercase animate-[fade-in_1s_ease-out]"
                  style={{ color: '#6b5c4d' }}
                >
                  1 HP Restored
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Phase 4b: Death */}
      {phase === 'death' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 gap-6">
          {/* Red gradient line */}
          <div className="w-48 h-px" style={{ background: 'linear-gradient(90deg, transparent, #c94444, transparent)' }} />

          <p className="font-cinzel text-xl text-[#c94444] text-center">
            The bond breaks.
          </p>

          <div className="flex flex-col items-center gap-3 max-w-[300px]">
            <p className="font-cinzel italic text-sm text-[#6b5c4d] text-center leading-relaxed">
              The silence that follows is the loudest thing you've ever heard.
            </p>
            <p className="font-cinzel italic text-sm text-[#6b5c4d] text-center leading-relaxed">
              You and your dragon have fallen.
            </p>
          </div>

          <div className="w-48 h-px" style={{ background: 'linear-gradient(90deg, transparent, #c94444, transparent)' }} />

          <button
            onClick={onDeath}
            className="mt-4 min-h-[48px] px-8 py-3 rounded-full font-cinzel font-bold text-sm tracking-wider uppercase
              border transition-all duration-200 active:scale-95"
            style={{
              backgroundColor: 'transparent',
              borderColor: '#c94444',
              color: '#c94444',
            }}
          >
            Face what comes next
          </button>
        </div>
      )}

      <style>{`
        @keyframes ember-pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.5); }
        }
        @keyframes tumble-number {
          0% { transform: translateY(-2px) rotate(-3deg); }
          50% { transform: translateY(2px) rotate(3deg); }
          100% { transform: translateY(-2px) rotate(-3deg); }
        }
        @keyframes save-pulse {
          0%, 100% { box-shadow: 0 0 15px rgba(201,68,68,0.2); }
          50% { box-shadow: 0 0 25px rgba(201,68,68,0.4); }
        }
        @keyframes roar-vibrate {
          0% { transform: translateX(0); }
          25% { transform: translateX(-2px) translateY(1px); }
          50% { transform: translateX(2px) translateY(-1px); }
          75% { transform: translateX(-1px) translateY(1px); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default DeathSaveScreen;
