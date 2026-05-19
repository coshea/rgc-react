import { FC, useState, useEffect } from "react";
import { Switch, useTheme } from "@heroui/react";
import clsx from "clsx";

import { SunFilledIcon, MoonFilledIcon } from "@/components/icons";

export interface ThemeSwitchProps {
  className?: string;
}

export const ThemeSwitch: FC<ThemeSwitchProps> = ({ className }) => {
  const [isMounted, setIsMounted] = useState(false);
  const { theme, setTheme } = useTheme("light");
  const isLight = theme === "light";

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Prevent Hydration Mismatch
  if (!isMounted) return <div className="w-6 h-6" />;

  return (
    <Switch
      isSelected={isLight}
      onChange={() => setTheme(isLight ? "dark" : "light")}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      className={clsx(
        "px-px transition-opacity hover:opacity-80 cursor-pointer",
        className,
      )}
    >
      <Switch.Control className="bg-transparent rounded-lg flex items-center justify-center group-data-[selected=true]:bg-transparent !text-muted pt-px px-0 mx-0">
        <Switch.Thumb>
          <Switch.Icon>
            {isLight ? (
              <MoonFilledIcon size={22} />
            ) : (
              <SunFilledIcon size={22} />
            )}
          </Switch.Icon>
        </Switch.Thumb>
      </Switch.Control>
    </Switch>
  );
};
