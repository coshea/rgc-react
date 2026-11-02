import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useLocation, useNavigate } from "react-router-dom";

import { siteConfig } from "@/config/site";

interface BackButtonProps {
  /**
   * Optional custom navigation action. If not provided, goes back in history,
   * or home when there is no in-app history
   */
  onPress?: () => void;
  /**
   * Optional label text. Defaults to "Back"
   */
  label?: string;
  /**
   * Whether to show label on all screen sizes. Defaults to true.
   * When false, label is hidden on small screens.
   */
  showLabelOnMobile?: boolean;
}

/**
 * Standardized back button component for consistent navigation across the site.
 * Uses flat variant with arrow-left icon.
 */
export default function BackButton({
  onPress,
  label = "Back",
  showLabelOnMobile = true,
}: BackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }

    // The first entry in the session (bookmark, email link, new tab) has no
    // in-app page to return to, so go home instead of leaving the site.
    if (location.key === "default") {
      navigate(siteConfig.pages.home.link);
      return;
    }

    navigate(-1);
  };

  return (
    <Button variant="tertiary" size="sm" onPress={handlePress}>
      <Icon icon="lucide:arrow-left" className="w-4 h-4" />
      <span className={showLabelOnMobile ? "" : "hidden sm:inline"}>
        {label}
      </span>
    </Button>
  );
}
