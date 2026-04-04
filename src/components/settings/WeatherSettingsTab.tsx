import { useState } from 'react';
import { useWeather } from '@/hooks/use-weather';
import { loadWeatherCoords, windDirectionToCompass } from '@/lib/weather';
import type { WeatherCondition } from '@/lib/weather';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Cloud, RefreshCw, MapPin, Droplets, Wind, Eye, Sun, Thermometer, ArrowUp, Clock } from 'lucide-react';
import { toast } from 'sonner';

function getWeatherEmoji(condition: WeatherCondition, isDay: boolean): string {
  switch (condition) {
    case 'clear': return isDay ? '☀️' : '🌙';
    case 'cloudy': return '☁️';
    case 'fog': return '🌫️';
    case 'drizzle': return '🌦️';
    case 'rain': return '🌧️';
    case 'heavy-rain': return '⛈️';
    case 'snow': return '❄️';
    case 'thunderstorm': return '⛈️';
    default: return '☁️';
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${m} ${ampm}`;
}

function formatHour(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr} ${ampm}`;
}

function formatVisibility(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function uvLabel(uv: number): { text: string; color: string } {
  if (uv <= 2) return { text: 'Low', color: 'text-green-400' };
  if (uv <= 5) return { text: 'Moderate', color: 'text-yellow-400' };
  if (uv <= 7) return { text: 'High', color: 'text-orange-400' };
  if (uv <= 10) return { text: 'Very High', color: 'text-red-400' };
  return { text: 'Extreme', color: 'text-red-500' };
}

export function WeatherSettingsTab() {
  const weather = useWeather();
  const [coords, setCoords] = useState(() => {
    const saved = loadWeatherCoords();
    return { lat: saved?.lat?.toString() ?? '', lon: saved?.lon?.toString() ?? '' };
  });

  const handleSaveCoords = () => {
    const lat = parseFloat(coords.lat);
    const lon = parseFloat(coords.lon);
    if (isNaN(lat) || isNaN(lon)) {
      toast.error('Enter valid latitude and longitude numbers.');
      return;
    }
    weather.setCoords(lat, lon);
    toast.success('Location saved.');
  };

  const w = weather.weather;

  return (
    <div className="flex-1 space-y-4 pb-6">
      {/* Title */}
      <div className="px-1">
        <h2 className="font-cinzel text-lg text-foreground flex items-center gap-2">
          <Cloud className="w-5 h-5 text-sky-400" />
          Live Weather
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Sync real-world weather to your home screen.
        </p>
      </div>

      {/* Enable toggle */}
      <div className="bg-card/50 border border-border/50 rounded-lg p-4 flex items-center justify-between">
        <span className="text-sm text-foreground">Enable Weather Overlay</span>
        <Switch checked={weather.enabled} onCheckedChange={weather.setEnabled} />
      </div>

      {weather.enabled && (
        <div className="space-y-3">
          {/* Rich weather dashboard */}
          {w && (
            <div className="space-y-3">
              {/* SECTION 1: Current Conditions Hero Card */}
              <div className="bg-card/50 border border-border/50 rounded-xl p-5">
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <span className="text-4xl">{getWeatherEmoji(w.condition, w.isDay)}</span>
                  <div className="text-right">
                    <p className="font-cinzel text-lg text-foreground capitalize">
                      {w.condition.replace('-', ' ')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Feels like {Math.round(w.feelsLike)}°F
                    </p>
                  </div>
                </div>

                {/* Temperature */}
                <div className="text-center my-4">
                  <p className="text-5xl font-bold font-cinzel text-foreground">
                    {Math.round(w.temperature)}<span className="text-xl">°F</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    H: {Math.round(w.tempMax)}° &nbsp; L: {Math.round(w.tempMin)}°
                  </p>
                </div>

                {/* Sunrise / Sunset */}
                {(w.sunrise || w.sunset) && (
                  <div className="flex items-center justify-center gap-3 mt-3">
                    {w.sunrise && (
                      <span className="bg-card/30 border border-border/30 rounded-full px-3 py-1 text-xs text-muted-foreground">
                        🌅 {formatTime(w.sunrise)}
                      </span>
                    )}
                    {w.sunset && (
                      <span className="bg-card/30 border border-border/30 rounded-full px-3 py-1 text-xs text-muted-foreground">
                        🌇 {formatTime(w.sunset)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION 2: Stats Grid */}
              <div className="grid grid-cols-2 gap-2">
                {/* Humidity */}
                <div className="bg-card/30 border border-border/30 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Droplets className="w-4 h-4 text-sky-400" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-cinzel">Humidity</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{w.humidity}%</p>
                </div>

                {/* Wind */}
                <div className="bg-card/30 border border-border/30 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Wind className="w-4 h-4 text-emerald-400" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-cinzel">Wind</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {Math.round(w.windSpeed)} mph {windDirectionToCompass(w.windDirection)}
                  </p>
                  {w.windGusts != null && w.windGusts > w.windSpeed && (
                    <p className="text-[10px] text-muted-foreground">Gusts: {Math.round(w.windGusts)} mph</p>
                  )}
                </div>

                {/* Visibility */}
                <div className="bg-card/30 border border-border/30 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Eye className="w-4 h-4 text-violet-400" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-cinzel">Visibility</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{formatVisibility(w.visibility)}</p>
                </div>

                {/* Cloud Cover */}
                <div className="bg-card/30 border border-border/30 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Cloud className="w-4 h-4 text-slate-400" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-cinzel">Cloud Cover</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{w.cloudCover}%</p>
                </div>

                {/* Precipitation */}
                <div className="bg-card/30 border border-border/30 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Droplets className="w-4 h-4 text-blue-400" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-cinzel">Precipitation</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {w.precipitation > 0 ? `${w.precipitation} mm/h` : 'None'}
                  </p>
                </div>

                {/* UV Index */}
                <div className="bg-card/30 border border-border/30 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-cinzel">UV Index</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {w.uvIndex} <span className={`text-[10px] font-normal ${uvLabel(w.uvIndex).color}`}>{uvLabel(w.uvIndex).text}</span>
                  </p>
                </div>
              </div>

              {/* SECTION 3: 6-Hour Forecast Strip */}
              {w.forecast && w.forecast.length > 0 && (
                <div>
                  <p className="text-xs font-cinzel uppercase tracking-wider text-muted-foreground mb-2 px-1">
                    Next 6 Hours
                  </p>
                  <div className="flex overflow-x-auto gap-2 pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {w.forecast.map((hour, i) => (
                      <div
                        key={i}
                        className="min-w-[72px] bg-card/30 border border-border/30 rounded-lg p-2.5 flex flex-col items-center gap-1 shrink-0"
                      >
                        <span className="text-[10px] text-muted-foreground">{formatHour(hour.time)}</span>
                        <span className="text-lg">{getWeatherEmoji(hour.condition, true)}</span>
                        <span className="text-xs font-semibold text-foreground">{Math.round(hour.temperature)}°</span>
                        {hour.precipitationProbability > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] text-blue-400">
                            <Droplets className="w-3 h-3" />
                            {hour.precipitationProbability}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Loading */}
          {weather.loading && (
            <div className="flex items-center gap-2 px-1">
              <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />
              <span className="text-xs text-muted-foreground">Fetching weather...</span>
            </div>
          )}

          {/* Error */}
          {weather.error && (
            <p className="text-xs text-amber-400 px-1">{weather.error}</p>
          )}

          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={weather.loading}
            onClick={weather.refresh}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Weather
          </Button>

          {/* Manual location */}
          <div className="bg-card/50 border border-border/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-sky-400" />
              <span className="text-sm text-foreground font-medium">Manual Location</span>
            </div>
            <p className="text-xs text-muted-foreground">Used when GPS is unavailable.</p>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Latitude"
                value={coords.lat}
                onChange={(e) => setCoords(prev => ({ ...prev, lat: e.target.value }))}
                className="flex-1"
              />
              <Input
                type="text"
                placeholder="Longitude"
                value={coords.lon}
                onChange={(e) => setCoords(prev => ({ ...prev, lon: e.target.value }))}
                className="flex-1"
              />
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={handleSaveCoords}>
              Save Location
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
