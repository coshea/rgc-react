import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";

interface BackButtonProps {
  /**
   * Optional custom navigation action. If not provided, uses navigate(-1)
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

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }

    // Attempt to go back in history. If there is no prior entry (e.g. MemoryRouter
    // initial entry), navigate(-1) will not change the location. In that case,
    // fall back to a sane default route so the user is not stuck.
    const prevPath = window.location.pathname;
    navigate(-1);

    // If navigate(-1) did not change the path, schedule a microtask to navigate
    // to the fallback. A tiny timeout is used so this works predictably in tests
    // and in environments where history cannot go back.
    setTimeout(() => {
      if (window.location.pathname === prevPath) {
        navigate("/");
      }
    }, 0);
  };

  return (
    <Button
      variant="flat"
      size="sm"
      startContent={<Icon icon="lucide:arrow-left" className="w-4 h-4" />}
      onPress={handlePress}
    >
      <span className={showLabelOnMobile ? "" : "hidden sm:inline"}>
        {label}
      </span>
    </Button>
  );
}
