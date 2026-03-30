import React, { useState, useEffect, useCallback } from 'react';
import { rollWeightedDie, loadDiceOddsMode } from '@/lib/diceOdds';

interface GroundButtonProps {
  active: boolean;
  onGround: () => void;
  currentHP: number;
  maxHP: number;
  onFailedRoll: (damage: number) => void;
}

function getGroundingDamage(roll: number, maxHP: number): number {
  return Math.max(1, Math.ceil(maxHP * 0.2 * (20 - roll) / 19));
}

const GroundButton: React.FC<GroundButtonProps> = ({ active, onGround, currentHP, maxHP, onFailedRoll }) => {
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [lastDamage, setLastDamage] = useState<number>(0);
  const [showResult, setShowResult] = useState(false);
  const [isGrounded, setIsGrounded] = useState(false);
  const [rolling, setRolling] = useState(false);

  // Reset when deactivated
  useEffect(() => {
    if (!active) {
      setLastRoll(null);
      setShowResult(false);
      setIsGrounded(false);
      setRolling(false);
    }
  }, [active]);

  const handleRoll = useCallback(() => {
    if (rolling || isGrounded || currentHP <= 0) return;
    setRolling(true);

    const result = rollWeightedDie(20, loadDiceOddsMode());
    setLastRoll(result);
    setShowResult(true);

    if (result === 20) {
      setIsGrounded(true);
      navigator.vibrate?.(0);
      setTimeout(() => {
        onGround();
      }, 1500);
    } else {
      const damage = getGroundingDamage(result, maxHP);
      setLastDamage(damage);
      onFailedRoll(damage);
      // Screen shake on high-damage rolls (1-5)
      if (result <= 5) {
        document.documentElement.classList.add('ground-screen-shake');
        setTimeout(() => document.documentElement.classList.remove('ground-screen-shake'), 500);
      }
      setTimeout(() => {
        setRolling(false);
      }, 1200);
    }

    setTimeout(() => {
      setShowResult(false);
    }, 1500);
  }, [rolling, isGrounded, onGround, onFailedRoll, currentHP, maxHP]);

  if (!active) return null;

  // HP-based darkening: 0 at full HP, 1.0 at 0 HP — no cap
  const darkenOpacity = maxHP > 0 ? Math.max(0, 1 - (currentHP / maxHP)) : 0;
  const isUnconscious = currentHP <= 0;

  return (
    <>
      {/* Progressive darkening from HP loss */}
      {darkenOpacity > 0 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: 71,
            backgroundColor: `rgba(0, 0, 0, ${darkenOpacity})`,
            transition: 'background-color 0.5s ease',
          }}
        />
      )}

      {/* Roll result display */}
      {showResult && lastRoll !== null && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 73 }}
        >
          <div
            className={`font-cinzel font-bold text-6xl transition-all duration-300 ${
              lastRoll === 20
                ? 'text-amber-300 scale-150 drop-shadow-[0_0_30px_rgba(255,200,50,0.8)]'
                : lastRoll === 1
                  ? 'text-red-500 scale-110 drop-shadow-[0_0_20px_rgba(255,50,50,0.6)]'
                  : 'text-white/80 scale-100 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]'
            }`}
            style={{
              animation: lastRoll === 20
                ? 'pulse 0.5s ease-in-out'
                : 'shake-result 0.3s ease-in-out',
            }}
          >
            {lastRoll}
          </div>
          {lastRoll === 20 && (
            <div className="absolute text-amber-200/80 font-cinzel text-sm mt-20 tracking-widest uppercase">
              Grounded
            </div>
          )}
          {lastRoll !== null && lastRoll < 20 && (
            <div className="absolute text-red-400 font-cinzel text-lg mt-20 font-bold drop-shadow-[0_0_8px_rgba(255,50,50,0.5)]">
              -{lastDamage} HP
            </div>
          )}
        </div>
      )}

      {/* Success flash */}
      {isGrounded && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: 72,
            background: 'radial-gradient(circle at center, rgba(255,200,50,0.4) 0%, transparent 70%)',
            animation: 'ground-flash 1.5s ease-out forwards',
          }}
        />
      )}

      {/* Ground button — hidden when unconscious or grounded */}
      {!isGrounded && !isUnconscious && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 74 }}
        >
          <button
            onClick={handleRoll}
            disabled={rolling}
            className="min-h-[48px] min-w-[120px] px-8 py-3 rounded-full font-cinzel font-bold text-lg tracking-wider uppercase
              bg-gradient-to-r from-amber-700/90 via-orange-600/90 to-red-700/90
              text-amber-100 border border-amber-500/40
              disabled:opacity-60
              transition-all duration-200 active:scale-95"
            style={{
              pointerEvents: 'auto',
              boxShadow: '0 0 20px rgba(255, 150, 50, 0.4), 0 0 40px rgba(255, 100, 20, 0.2), inset 0 1px 0 rgba(255,255,255,0.15)',
              animation: rolling ? 'none' : 'ground-pulse 2s ease-in-out infinite',
            }}
          >
            Ground!
          </button>
        </div>
      )}

      <style>{`
        @keyframes ground-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(255,150,50,0.4), 0 0 40px rgba(255,100,20,0.2); transform: scale(1); }
          50% { box-shadow: 0 0 30px rgba(255,150,50,0.6), 0 0 60px rgba(255,100,20,0.35); transform: scale(1.05); }
        }
        @keyframes ground-flash {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes shake-result {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
      `}</style>
    </>
  );
};

export default GroundButton;
