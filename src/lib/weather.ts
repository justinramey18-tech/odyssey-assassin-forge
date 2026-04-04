export type WeatherCondition = 'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'heavy-rain' | 'snow' | 'thunderstorm';

export interface WeatherData {
  // Current conditions
  condition: WeatherCondition;
  temperature: number;        // Fahrenheit
  feelsLike: number;          // Apparent temperature, Fahrenheit
  humidity: number;           // Relative humidity 0-100%
  windSpeed: number;          // mph
  windGusts: number;          // mph
  windDirection: number;      // degrees (0=N, 90=E, 180=S, 270=W)
  cloudCover: number;         // 0-100%
  visibility: number;         // meters
  precipitation: number;      // mm/h current precipitation rate
  uvIndex: number;            // UV index
  isDay: boolean;
  // Daily
  sunrise: string;            // ISO time string
  sunset: string;             // ISO time string
  tempMax: number;            // Fahrenheit, today's max
  tempMin: number;            // Fahrenheit, today's min
  // Forecast (next 6 hours)
  forecast: ForecastHour[];
}

export interface ForecastHour {
  time: string;               // ISO time string
  condition: WeatherCondition;
  temperature: number;        // Fahrenheit
  precipitationProbability: number; // 0-100%
  windSpeed: number;          // mph
}

export function mapWeatherCode(code: number): WeatherCondition {
  switch (code) {
    case 0: return 'clear';
    case 1: case 2: case 3: return 'cloudy';
    case 45: case 48: return 'fog';
    case 51: case 53: case 55: case 56: case 57: return 'drizzle';
    case 61: case 63: case 80: return 'rain';
    case 65: case 66: case 67: case 81: case 82: return 'heavy-rain';
    case 71: case 73: case 75: case 77: case 85: case 86: return 'snow';
    case 95: case 96: case 99: return 'thunderstorm';
    default: return 'cloudy';
  }
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weathercode,windspeed_10m,windgusts_10m,winddirection_10m,cloudcover,precipitation,visibility,uv_index,is_day&hourly=temperature_2m,weathercode,precipitation_probability,windspeed_10m&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min,weathercode&temperature_unit=fahrenheit&windspeed_unit=mph&forecast_days=1&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
  const json = await res.json();
  const c = json.current;

  // Build 6-hour forecast from hourly data
  const forecast: ForecastHour[] = [];
  if (json.hourly && json.hourly.time) {
    const now = new Date();
    for (let i = 0; i < json.hourly.time.length && forecast.length < 6; i++) {
      const hourTime = new Date(json.hourly.time[i]);
      if (hourTime > now) {
        forecast.push({
          time: json.hourly.time[i],
          condition: mapWeatherCode(json.hourly.weathercode[i]),
          temperature: json.hourly.temperature_2m[i],
          precipitationProbability: json.hourly.precipitation_probability?.[i] ?? 0,
          windSpeed: json.hourly.windspeed_10m?.[i] ?? 0,
        });
      }
    }
  }

  // Daily data (today)
  const daily = json.daily || {};
  const sunrise = daily.sunrise?.[0] ?? '';
  const sunset = daily.sunset?.[0] ?? '';
  const tempMax = daily.temperature_2m_max?.[0] ?? c.temperature_2m;
  const tempMin = daily.temperature_2m_min?.[0] ?? c.temperature_2m;

  return {
    condition: mapWeatherCode(c.weathercode),
    temperature: c.temperature_2m,
    feelsLike: c.apparent_temperature,
    humidity: c.relative_humidity_2m,
    windSpeed: c.windspeed_10m,
    windGusts: c.windgusts_10m ?? c.windspeed_10m,
    windDirection: c.winddirection_10m ?? 0,
    cloudCover: c.cloudcover,
    visibility: c.visibility ?? 10000,
    precipitation: c.precipitation ?? 0,
    uvIndex: c.uv_index ?? 0,
    isDay: c.is_day === 1,
    sunrise,
    sunset,
    tempMax,
    tempMin,
    forecast,
  };
}

export function windDirectionToCompass(degrees: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return dirs[index];
}

export function loadWeatherEnabled(): boolean {
  try {
    return localStorage.getItem('odyssey-weather-enabled') === 'true';
  } catch { return false; }
}

export function saveWeatherEnabled(enabled: boolean): void {
  try { localStorage.setItem('odyssey-weather-enabled', String(enabled)); } catch {}
}

export function loadWeatherCoords(): { lat: number; lon: number } | null {
  try {
    const raw = localStorage.getItem('odyssey-weather-coords');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function saveWeatherCoords(lat: number, lon: number): void {
  try { localStorage.setItem('odyssey-weather-coords', JSON.stringify({ lat, lon })); } catch {}
}

export function weatherToNarrativeContext(weather: WeatherData): string {
  const temp = `Temperature is around ${Math.round(weather.temperature)}°F.`;
  let wind = '';
  if (weather.windSpeed > 35) wind = ` Gale-force winds make travel dangerous.`;
  else if (weather.windSpeed > 20) wind = ` Strong winds howl through the area.`;
  else if (weather.condition === 'rain' || weather.condition === 'heavy-rain' || weather.condition === 'thunderstorm') wind = ` Winds blow at ${Math.round(weather.windSpeed)}mph.`;

  switch (weather.condition) {
    case 'clear':
      return weather.isDay
        ? `The sky is clear and bright. Sunlight warms the land. ${temp}`
        : `A clear night sky reveals a canopy of stars. The air is cool. ${temp}`;
    case 'cloudy':
      return `Heavy clouds blanket the sky, casting a grey pallor over the landscape. ${temp}`;
    case 'fog':
      return `A thick fog clings to the ground, reducing visibility to mere feet. The air is damp and still. ${temp}`;
    case 'drizzle':
      return `A light drizzle mists the air, barely enough to dampen cloaks. ${temp}`;
    case 'rain':
      return `Steady rain falls from iron-grey clouds, drumming against rooftops and pooling in the roads. ${temp}${wind}`;
    case 'heavy-rain':
      return `Torrential rain hammers down, turning paths to mud and reducing visibility. Wind gusts drive the rain sideways. ${temp}${wind}`;
    case 'snow':
      return `Snow falls silently, blanketing the world in white. The air is frigid. ${temp}`;
    case 'thunderstorm':
      return `A violent thunderstorm rages overhead. Lightning splits the sky and thunder shakes the ground. ${temp}${wind}`;
    default:
      return `${temp}`;
  }
}
