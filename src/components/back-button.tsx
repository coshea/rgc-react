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
    } else {
      navigate(-1);
    }
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
