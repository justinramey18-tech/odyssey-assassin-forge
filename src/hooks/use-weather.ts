import { useState, useCallback, useEffect, useRef } from 'react';
import {
  WeatherData,
  fetchWeather,
  loadWeatherEnabled,
  saveWeatherEnabled,
  loadWeatherCoords,
  saveWeatherCoords,
} from '@/lib/weather';

const CACHE_KEY = 'odyssey-weather-cache';
const CACHE_MAX_AGE = 30 * 60 * 1000; // 30 minutes

interface CachedWeather {
  data: WeatherData;
  timestamp: number;
}

function loadCache(): CachedWeather | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed?.data ||
      typeof parsed.data.feelsLike !== 'number' ||
      typeof parsed.data.humidity !== 'number' ||
      !Array.isArray(parsed.data.forecast)
    ) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(data: WeatherData): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {}
}

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [enabled, setEnabledState] = useState(() => loadWeatherEnabled());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coordsRef = useRef<{ lat: number; lon: number } | null>(loadWeatherCoords());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const doFetch = useCallback(async (lat: number, lon: number) => {
    if (!mountedRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWeather(lat, lon);
      if (!mountedRef.current) return;
      setWeather(data);
      saveCache(data);
    } catch (e: any) {
      if (mountedRef.current) setError(e?.message || 'Failed to fetch weather');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const resolveAndFetch = useCallback((forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = loadCache();
      if (cached && Date.now() - cached.timestamp < CACHE_MAX_AGE) {
        setWeather(cached.data);
        return;
      }
    }

    const tryFetch = (lat: number, lon: number) => {
      coordsRef.current = { lat, lon };
      saveWeatherCoords(lat, lon);
      doFetch(lat, lon);
    };

    if (!navigator.geolocation) {
      const saved = coordsRef.current || loadWeatherCoords();
      if (saved) {
        doFetch(saved.lat, saved.lon);
      } else {
        setError('Location unavailable. Set manually in Settings.');
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => tryFetch(pos.coords.latitude, pos.coords.longitude),
      () => {
        const saved = coordsRef.current || loadWeatherCoords();
        if (saved) {
          doFetch(saved.lat, saved.lon);
        } else {
          if (mountedRef.current) setError('Location unavailable. Set manually in Settings.');
        }
      },
      { timeout: 10000, maximumAge: CACHE_MAX_AGE }
    );
  }, [doFetch]);

  // Init on mount
  useEffect(() => {
    if (!enabled) return;
    const cached = loadCache();
    if (cached) setWeather(cached.data);
    resolveAndFetch();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  const refresh = useCallback(() => {
    if (!enabled) return;
    resolveAndFetch(true);
  }, [enabled, resolveAndFetch]);

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    saveWeatherEnabled(v);
    if (v) {
      resolveAndFetch(true);
    } else {
      setWeather(null);
      setError(null);
    }
  }, [resolveAndFetch]);

  const setCoords = useCallback((lat: number, lon: number) => {
    coordsRef.current = { lat, lon };
    saveWeatherCoords(lat, lon);
    if (enabled) {
      doFetch(lat, lon);
    }
  }, [enabled, doFetch]);

  return { weather, enabled, loading, error, refresh, setEnabled, setCoords };
}
