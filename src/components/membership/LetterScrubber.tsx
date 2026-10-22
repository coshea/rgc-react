import type React from "react";

interface LetterScrubberProps {
  letters: string[];
  onJump: (letter: string) => void;
}

/**
 * Phone A–Z index on the right edge. Tap a letter, or drag along the strip
 * like the iOS contacts index.
 */
export function LetterScrubber({ letters, onJump }: LetterScrubberProps) {
  if (letters.length < 2) return null;

  const handleTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const letter = target instanceof HTMLElement ? target.dataset.letter : "";
    if (letter) onJump(letter);
  };

  return (
    <nav
      aria-label="Jump to letter"
      className="fixed right-0.5 top-1/2 z-20 flex -translate-y-1/2 touch-none flex-col items-center py-1 lg:hidden"
      onTouchMove={handleTouchMove}
    >
      {letters.map((letter) => (
        // Raw button: HeroUI Button's minimum size is too big for a 26-letter
        // strip; the strip is a drag target, and each letter stays focusable.
        <button
          key={letter}
          type="button"
          data-letter={letter}
          onClick={() => onJump(letter)}
          aria-label={`Jump to ${letter}`}
          className="w-6 text-[11px] leading-4 text-accent outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {letter}
        </button>
      ))}
    </nav>
  );
}
