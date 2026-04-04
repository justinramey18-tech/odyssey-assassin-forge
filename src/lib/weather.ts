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
  const lines: string[] = [];

  // 1. Time of day context from sunrise/sunset
  if (weather.sunrise && weather.sunset) {
    const now = new Date();
    const sunrise = new Date(weather.sunrise);
    const sunset = new Date(weather.sunset);
    const sunriseHr = sunrise.getHours();
    const sunsetHr = sunset.getHours();
    const nowHr = now.getHours();

    if (weather.isDay) {
      if (nowHr <= sunriseHr + 1) {
        lines.push('It is early dawn. The sun has just crested the horizon, casting long shadows.');
      } else if (nowHr >= sunsetHr - 1) {
        lines.push('The sun hangs low on the horizon, painting the sky in shades of amber and violet. Dusk approaches.');
      } else if (nowHr >= 11 && nowHr <= 14) {
        lines.push('The sun is at its peak — midday.');
      }
    } else {
      if (nowHr <= 1 || nowHr >= 23) {
        lines.push('It is the dead of night. Midnight has passed.');
      } else if (nowHr >= sunsetHr && nowHr <= sunsetHr + 2) {
        lines.push('Night has fallen recently. The last glow of twilight fades from the western sky.');
      } else if (nowHr >= sunriseHr - 2 && nowHr < sunriseHr) {
        lines.push('The darkest hours before dawn. The eastern sky shows no light yet.');
      }
    }
  }

  // 2. Core weather condition
  const compass = windDirectionToCompass(weather.windDirection);
  switch (weather.condition) {
    case 'clear':
      if (weather.isDay) {
        lines.push('The sky is clear and open. Unbroken blue stretches to every horizon.');
        if (weather.uvIndex >= 8) lines.push('The sun beats down with punishing intensity — exposed skin burns quickly.');
        else if (weather.uvIndex >= 5) lines.push('The sun is strong overhead.');
      } else {
        lines.push('A clear night sky reveals a canopy of stars. The air is still and open.');
      }
      break;
    case 'cloudy':
      if (weather.cloudCover >= 90) lines.push('A solid ceiling of grey clouds smothers the sky. No sunlight breaks through.');
      else if (weather.cloudCover >= 60) lines.push('Heavy clouds blanket most of the sky, casting a grey pallor over the landscape.');
      else lines.push('Patches of cloud drift across the sky, intermittently blocking the light.');
      break;
    case 'fog':
      if (weather.visibility < 200) lines.push('A suffocating fog has descended. Visibility is almost zero — shapes vanish beyond arm\'s reach.');
      else if (weather.visibility < 500) lines.push('Thick fog clings to the ground. Figures appear and disappear like ghosts at twenty paces.');
      else lines.push('A light fog hangs in the air, softening the edges of the world. Distant landmarks are hazy outlines.');
      break;
    case 'drizzle':
      lines.push('A fine drizzle mists the air — barely enough to dampen a cloak, but persistent.');
      break;
    case 'rain':
      lines.push(`Steady rain falls from iron-grey clouds, drumming against rooftops and pooling in the roads. The wind pushes the rain from the ${compass}.`);
      break;
    case 'heavy-rain':
      lines.push(`Torrential rain hammers down, turning paths to mud and reducing visibility. Wind from the ${compass} drives the rain sideways in sheets.`);
      break;
    case 'snow':
      lines.push('Snow falls steadily, blanketing the world in white. Each surface carries a growing layer of frost and powder.');
      break;
    case 'thunderstorm':
      lines.push(`A violent thunderstorm rages. Lightning splits the sky at irregular intervals and thunder rolls across the landscape. Rain and wind from the ${compass} lash everything exposed.`);
      break;
  }

  // 3. Temperature sensation (NEVER state the number)
  const feels = weather.feelsLike;
  if (feels <= 10) lines.push('The cold is brutal and biting — breath crystallizes instantly and exposed skin goes numb within minutes.');
  else if (feels <= 25) lines.push('The air is bitterly cold. Fingers stiffen and every breath is sharp in the lungs.');
  else if (feels <= 40) lines.push('The air carries a raw chill that seeps through layers of clothing.');
  else if (feels <= 55) lines.push('The air is cool and brisk.');
  else if (feels <= 70) lines.push('The temperature is comfortable — neither warm nor cold.');
  else if (feels <= 85) lines.push('The air is warm. Exertion brings sweat quickly.');
  else if (feels <= 95) lines.push('The heat is oppressive. The air shimmers and sweat soaks through clothing.');
  else lines.push('The heat is suffocating and dangerous. The air itself feels thick and hostile.');

  // 4. Humidity modifier
  if (weather.humidity >= 90 && weather.temperature >= 70) lines.push('The humidity is stifling — the air is thick as wet cloth.');
  else if (weather.humidity >= 80 && weather.temperature >= 65) lines.push('The air is muggy and damp.');
  else if (weather.humidity <= 20) lines.push('The air is bone-dry. Lips crack and throats parch.');

  // 5. Wind detail
  if (weather.windGusts >= 50) lines.push(`Gale-force gusts from the ${compass} threaten to knock travelers off their feet. Projectiles are unreliable.`);
  else if (weather.windGusts >= 35) lines.push(`Powerful wind gusts from the ${compass} howl through the area, making ranged attacks difficult.`);
  else if (weather.windSpeed >= 20) lines.push(`A strong wind blows from the ${compass}, tugging at cloaks and banners.`);
  else if (weather.windSpeed >= 10) lines.push(`A moderate breeze blows from the ${compass}.`);

  // 6. Visibility note (only if notably poor and not already covered by fog)
  if (weather.condition !== 'fog' && weather.visibility < 2000) {
    lines.push('Visibility is severely reduced — objects beyond a few hundred feet are obscured.');
  }

  // 7. Forecast foreshadowing (what's coming in the next few hours)
  if (weather.forecast && weather.forecast.length >= 2) {
    const upcoming = weather.forecast.slice(0, 3);
    const incomingStorm = upcoming.find(f => f.condition === 'thunderstorm' || f.condition === 'heavy-rain');
    const incomingRain = upcoming.find(f => f.condition === 'rain' || f.condition === 'drizzle');
    const incomingSnow = upcoming.find(f => f.condition === 'snow');
    const clearing = weather.condition !== 'clear' && upcoming.every(f => f.condition === 'clear' || f.condition === 'cloudy');
    const highPrecipChance = upcoming.some(f => f.precipitationProbability >= 70);

    if (incomingStorm && weather.condition !== 'thunderstorm') {
      lines.push('FORECAST: A storm is building on the horizon. Dark clouds mass in the distance and the air pressure is dropping. The storm will arrive within hours.');
    } else if (incomingSnow && weather.condition !== 'snow') {
      lines.push('FORECAST: Snow is expected soon. The air has that sharp, metallic edge that precedes snowfall.');
    } else if (incomingRain && weather.condition === 'clear') {
      lines.push('FORECAST: Clouds are gathering. Rain is likely within the next few hours.');
    } else if (clearing) {
      lines.push('FORECAST: The weather is improving. Conditions should clear within the next few hours.');
    } else if (highPrecipChance && weather.precipitation === 0) {
      lines.push('FORECAST: Precipitation is likely soon. The air feels heavy with moisture.');
    }
  }

  return lines.join(' ');
}
