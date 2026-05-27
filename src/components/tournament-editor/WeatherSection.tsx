import React from "react";
import { Card, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { Tournament } from "@/types/tournament";

interface Weather {
  condition: string;
  temperature: number;
  windSpeed: number;
  precipitation: number;
}

interface WeatherSectionProps {
  weather: Weather | null;
  date: unknown;
  fetchingWeather: boolean;
  onFetchWeather: () => void;
}

export const WeatherSection: React.FC<WeatherSectionProps> = ({
  weather,
  date,
  fetchingWeather,
  onFetchWeather,
}) => {
  return (
    <Card>
      <Card.Content className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Tournament Weather</h3>
          <Button
            size="sm"
            variant="tertiary"
            onPress={onFetchWeather}
            isDisabled={!date || fetchingWeather}
          >
            {!fetchingWeather && (
              <Icon icon="lucide:cloud" className="w-4 h-4" />
            )}
            {weather ? "Refresh" : "Fetch"} Weather
          </Button>
        </div>
        {weather ? (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted text-xs">Condition</p>
              <p className="font-medium">{weather.condition}</p>
            </div>
            <div>
              <p className="text-muted text-xs">Temperature</p>
              <p className="font-medium">{weather.temperature}°F</p>
            </div>
            <div>
              <p className="text-muted text-xs">Wind Speed</p>
              <p className="font-medium">{weather.windSpeed} mph</p>
            </div>
            <div>
              <p className="text-muted text-xs">Precipitation</p>
              <p className="font-medium">{weather.precipitation}"</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">
            {date
              ? "Click 'Fetch Weather' to load historical weather data"
              : "Set a tournament date to fetch weather"}
          </p>
        )}
      </Card.Content>
    </Card>
  );
};

export type { Weather, Tournament };
