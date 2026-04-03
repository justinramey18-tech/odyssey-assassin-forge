import { useState } from 'react';
import { useWeather } from '@/hooks/use-weather';
import { loadWeatherCoords } from '@/lib/weather';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Cloud, RefreshCw, MapPin } from 'lucide-react';
import { toast } from 'sonner';

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

  const conditionLabel = weather.weather
    ? weather.weather.condition.charAt(0).toUpperCase() + weather.weather.condition.slice(1)
    : '';

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
          {/* Current weather */}
          {weather.weather && (
            <div className="bg-card/50 border border-border/50 rounded-lg p-4">
              <p className="text-sm text-foreground">
                {conditionLabel} — {Math.round(weather.weather.temperature)}°F — {Math.round(weather.weather.windSpeed)}mph winds
              </p>
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
