import type { TournamentWeather } from "@/types/tournament";

// Ridgefield Golf Club coordinates (Ridgefield, CT)
const LATITUDE = 41.2815;
const LONGITUDE = -73.4982;

/**
 * Fetch historical weather data for a specific date, averaged between 7 AM - 1 PM ET using Open-Meteo API
 * Free API, no key required
 */
export async function fetchHistoricalWeather(
  date: Date
): Promise<TournamentWeather | null> {
  try {
    // Format date as YYYY-MM-DD
    const dateStr = date.toISOString().split("T")[0];

    // Open-Meteo historical weather API with hourly data
    const url = new URL("https://archive-api.open-meteo.com/v1/archive");
    url.searchParams.append("latitude", LATITUDE.toString());
    url.searchParams.append("longitude", LONGITUDE.toString());
    url.searchParams.append("start_date", dateStr);
    url.searchParams.append("end_date", dateStr);
    // Request hourly weather data fields for averaging between 7 AM and 1 PM
    url.searchParams.append(
      "hourly",
      [
        "temperature_2m",
        "precipitation",
        "windspeed_10m",
        "weathercode",
        "relativehumidity_2m",
      ].join(",")
    );
    url.searchParams.append("temperature_unit", "fahrenheit");
    url.searchParams.append("windspeed_unit", "mph");
    url.searchParams.append("precipitation_unit", "inch");
    url.searchParams.append("timezone", "America/New_York");

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error("Weather API error:", response.statusText);
      return null;
    }

    const data = await response.json();

    if (!data.hourly) {
      console.error("No weather data available for this date");
      return null;
    }

    // Average weather between 7 AM and 1 PM (hours 7-13, indices 7-13)
    // The API returns hourly data from 00:00 to 23:00
    const startHour = 7;
    const endHour = 13;
    const hours = endHour - startHour + 1; // 7 hours total

    // Calculate averages for the time period
    let tempSum = 0;
    let windSum = 0;
    let precipSum = 0;
    let humiditySum = 0;
    const weatherCodes: number[] = [];

    for (let i = startHour; i <= endHour; i++) {
      tempSum += data.hourly.temperature_2m?.[i] || 0;
      windSum += data.hourly.windspeed_10m?.[i] || 0;
      precipSum += data.hourly.precipitation?.[i] || 0;
      humiditySum += data.hourly.relativehumidity_2m?.[i] || 0;
      const code = data.hourly.weathercode?.[i];
      if (code !== undefined) weatherCodes.push(code);
    }

    const temperature = tempSum / hours;
    const windSpeed = windSum / hours;
    const precipitation = precipSum / hours;
    const humidity = humiditySum / hours;

    // Use the most common weather code during this period
    const weatherCode =
      weatherCodes.length > 0
        ? (() => {
            const freqMap = new Map<number, number>();
            weatherCodes.forEach((code) =>
              freqMap.set(code, (freqMap.get(code) || 0) + 1)
            );
            return Array.from(freqMap.entries()).reduce((a, b) =>
              a[1] > b[1] ? a : b
            )[0];
          })()
        : 0;
    const condition = getWeatherCondition(weatherCode);

    return {
      temperature: Math.round(temperature),
      condition,
      windSpeed: Math.round(windSpeed),
      precipitation: Math.round(precipitation * 100) / 100,
      humidity: Math.round(humidity),
    };
  } catch (error) {
    console.error("Failed to fetch weather data:", error);
    return null;
  }
}

/**
 * Convert WMO weather code to human-readable condition
 * https://open-meteo.com/en/docs
 */
function getWeatherCondition(code: number): string {
  if (code === 0) return "Clear Sky";
  if (code === 1) return "Mainly Clear";
  if (code === 2) return "Partly Cloudy";
  if (code === 3) return "Overcast";
  if (code >= 45 && code <= 48) return "Foggy";
  if (code >= 51 && code <= 55) return "Drizzle";
  if (code >= 56 && code <= 57) return "Freezing Drizzle";
  if (code >= 61 && code <= 65) return "Rain";
  if (code >= 66 && code <= 67) return "Freezing Rain";
  if (code >= 71 && code <= 75) return "Snow";
  if (code === 77) return "Snow Grains";
  if (code >= 80 && code <= 82) return "Rain Showers";
  if (code >= 85 && code <= 86) return "Snow Showers";
  if (code === 95) return "Thunderstorm";
  if (code >= 96 && code <= 99) return "Thunderstorm with Hail";
  return "Unknown";
}

/**
 * Get weather icon based on condition
 */
export function getWeatherIcon(condition: string): string {
  const lower = condition.toLowerCase();
  if (lower.includes("clear") || lower.includes("sunny")) return "lucide:sun";
  if (lower.includes("partly cloudy")) return "lucide:cloud-sun";
  if (lower.includes("cloudy") || lower.includes("overcast"))
    return "lucide:cloud";
  if (lower.includes("rain") || lower.includes("drizzle"))
    return "lucide:cloud-rain";
  if (lower.includes("snow")) return "lucide:snowflake";
  if (lower.includes("thunder")) return "lucide:cloud-lightning";
  if (lower.includes("fog")) return "lucide:cloud-fog";
  return "lucide:cloud";
}
