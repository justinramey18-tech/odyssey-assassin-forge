import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { WeatherCondition } from '@/lib/weather';

interface WeatherOverlayProps {
  condition: WeatherCondition;
  windSpeed: number;
  isDay: boolean;
}

const WeatherOverlay = ({ condition, windSpeed, isDay }: WeatherOverlayProps) => {
  const [flash, setFlash] = useState(false);

  // Lightning flash for thunderstorm
  useEffect(() => {
    if (condition !== 'thunderstorm') return;
    const scheduleFlash = () => {
      const delay = 5000 + Math.random() * 10000;
      return setTimeout(() => {
        setFlash(true);
        if (navigator.vibrate) navigator.vibrate(30);
        setTimeout(() => setFlash(false), 150);
        timerRef = scheduleFlash();
      }, delay);
    };
    let timerRef = scheduleFlash();
    return () => clearTimeout(timerRef);
  }, [condition]);

  const screenH = typeof window !== 'undefined' ? window.innerHeight : 900;

  const particles = useMemo(() => {
    const isRain = condition === 'rain' || condition === 'drizzle' || condition === 'heavy-rain' || condition === 'thunderstorm';

    if (isRain) {
      const count = condition === 'drizzle' ? 40 : (condition === 'rain' ? 60 : 80);
      const opacity = condition === 'drizzle' ? 0.4 : (condition === 'rain' ? 0.6 : 0.8);
      return Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        h: 15 + Math.random() * 15,
        delay: Math.random() * 3,
        duration: 0.6 + Math.random() * 0.6,
        opacity,
        drift: windSpeed * 0.3,
      }));
    }

    if (condition === 'snow') {
      return Array.from({ length: 40 }, (_, i) => {
        const isLarge = i > 34;
        return {
          id: i,
          x: Math.random() * 100,
          size: isLarge ? 8 + Math.random() * 2 : 3 + Math.random() * 4,
          opacity: isLarge ? 0.3 : 0.5 + Math.random() * 0.3,
          duration: 5 + Math.random() * 5,
          delay: Math.random() * 5,
          drift: 20 + Math.random() * 30,
        };
      });
    }

    if (condition === 'fog') {
      return Array.from({ length: 4 }, (_, i) => ({
        id: i,
        x: Math.random() * 80 - 10,
        y: Math.random() * 60,
        size: 200 + Math.random() * 200,
        opacity: 0.08 + Math.random() * 0.07,
        duration: 15 + Math.random() * 10,
      }));
    }

    if (condition === 'cloudy') {
      return Array.from({ length: 3 }, (_, i) => ({
        id: i,
        x: 10 + Math.random() * 60,
        y: 5 + Math.random() * 20,
        size: 300 + Math.random() * 200,
        opacity: 0.05 + Math.random() * 0.05,
        duration: 20 + Math.random() * 10,
      }));
    }

    if (condition === 'clear' && !isDay) {
      return Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 40,
        size: 1 + Math.random(),
        duration: 2 + Math.random() * 2,
        delay: Math.random() * 3,
      }));
    }

    return [];
  }, [condition, windSpeed, isDay, screenH]);

  // Clear daytime — render nothing
  if (condition === 'clear' && isDay) return null;
  if (particles.length === 0 && condition !== 'thunderstorm') return null;

  const isRain = condition === 'rain' || condition === 'drizzle' || condition === 'heavy-rain' || condition === 'thunderstorm';
  const showVignette = condition === 'heavy-rain' || condition === 'thunderstorm';

  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
      {/* Rain / Thunderstorm */}
      {isRain && particles.map((p: any) => (
        <motion.div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: -30,
            width: 2,
            height: p.h,
            backgroundColor: `rgba(150,180,220,${p.opacity})`,
            borderRadius: 1,
          }}
          animate={{ y: screenH + 30, x: p.drift }}
          transition={{
            y: { duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'linear' },
            x: { duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'linear' },
          }}
        />
      ))}

      {showVignette && (
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.3) 100%)' }}
        />
      )}

      {/* Lightning flash */}
      {condition === 'thunderstorm' && flash && (
        <div className="absolute inset-0" style={{ backgroundColor: 'white', opacity: 0.25 }} />
      )}

      {/* Snow */}
      {condition === 'snow' && particles.map((p: any) => (
        <motion.div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: -10,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            backgroundColor: 'white',
            opacity: p.opacity,
          }}
          animate={{
            y: screenH + 10,
            x: [0, p.drift, -p.drift, p.drift / 2, 0],
          }}
          transition={{
            y: { duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'linear' },
            x: { duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' },
          }}
        />
      ))}

      {/* Fog */}
      {condition === 'fog' && (
        <>
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.15)' }} />
          {particles.map((p: any) => (
            <motion.div
              key={p.id}
              style={{
                position: 'absolute',
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.size,
                height: p.size,
                borderRadius: '50%',
                background: `radial-gradient(circle, rgba(200,200,220,${p.opacity}) 0%, transparent 70%)`,
              }}
              animate={{ x: [-50, 50] }}
              transition={{ duration: p.duration, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
            />
          ))}
        </>
      )}

      {/* Cloudy */}
      {condition === 'cloudy' && particles.map((p: any) => (
        <motion.div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(0,0,0,${p.opacity}) 0%, transparent 70%)`,
            filter: 'blur(40px)',
          }}
          animate={{ x: [-30, 30] }}
          transition={{ duration: p.duration, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
        />
      ))}

      {/* Clear night stars */}
      {condition === 'clear' && !isDay && particles.map((p: any) => (
        <motion.div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            backgroundColor: 'white',
          }}
          animate={{ opacity: [0.2, 0.7, 0.2] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
};

export default WeatherOverlay;
