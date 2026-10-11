import React from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { DateValue } from "@internationalized/date";
import type { TournamentWeather } from "@/types/tournament";

interface WeatherSectionProps {
  weather: TournamentWeather | null;
  date: DateValue | null;
  fetchingWeather: boolean;
  onFetchWeather: () => void;
}

export const WeatherSection: React.FC<WeatherSectionProps> = ({
  weather,
  date,
  fetchingWeather,
  onFetchWeather,
}) => (
  <div className="space-y-3">
    {weather ? (
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {[
          ["Condition", weather.condition],
          ["Temperature", `${weather.temperature}°F`],
          ["Wind speed", `${weather.windSpeed} mph`],
          ["Precipitation", `${weather.precipitation}"`],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl bg-surface-secondary px-3 py-2"
          >
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    ) : (
      <p className="text-sm text-muted">
        {date
          ? "Load the recorded weather for the tournament date."
          : "Set a tournament date to fetch weather."}
      </p>
    )}
    <Button
      size="sm"
      variant="tertiary"
      onPress={onFetchWeather}
      isDisabled={!date || fetchingWeather}
      className="min-h-11 md:min-h-0"
    >
      {!fetchingWeather && <Icon icon="lucide:cloud" className="w-4 h-4" />}
      {weather ? "Refresh" : "Fetch"} Weather
    </Button>
  </div>
);
