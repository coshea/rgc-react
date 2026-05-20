import { FC, useState, useEffect } from "react";
import { Button, useTheme } from "@heroui/react";
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
  if (!isMounted) return <div className="w-8 h-8" />;

  return (
    <Button
      isIconOnly
      variant="ghost"
      size="sm"
      radius="full"
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      onPress={() => setTheme(isLight ? "dark" : "light")}
      className={clsx("text-muted", className)}
    >
      {isLight ? <MoonFilledIcon size={18} /> : <SunFilledIcon size={18} />}
    </Button>
  );
};
