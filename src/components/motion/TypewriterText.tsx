import * as React from "react";
import { useTypewriter } from "./useTypewriter";

export interface TypewriterTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** The full text to type out */
  text: string;
  /** Speed per character in milliseconds (default: 24) */
  speedMs?: number;
  /** Delay before typing starts in milliseconds (default: 0) */
  delayMs?: number;
  /** Whether to show a subtle caret cursor while typing (default: false) */
  showCaret?: boolean;
  /** Callback when typing completes */
  onComplete?: () => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * Production-ready TypewriterText component.
 * Features:
 * - Ghost text rendering: eliminates layout jumping and wrapping shifts.
 * - Screen-reader friendly: full text exposed via aria-label.
 * - Arabic RTL native: preserves cursive ligatures and punctuation.
 * - Instant on prefers-reduced-motion.
 */
export const TypewriterText = React.memo(function TypewriterText({
  text,
  speedMs = 24,
  delayMs = 0,
  showCaret = false,
  onComplete,
  className = "",
  ...props
}: TypewriterTextProps) {
  const { displayedText, remainingText, isTyping } = useTypewriter({
    text,
    speedMs,
    delayMs,
    onComplete,
  });

  return (
    <span className={`inline-block relative ${className}`} aria-label={text} role="text" {...props}>
      {/* Visible typed portion */}
      <span aria-hidden="true">{displayedText}</span>

      {/* Subtle cursor caret while typing */}
      {showCaret && isTyping && (
        <span
          aria-hidden="true"
          className="inline-block w-[2px] h-[1em] bg-primary align-middle mx-[1px] animate-caret"
        />
      )}

      {/* Invisible ghost remainder preserving layout geometry without jumping */}
      <span aria-hidden="true" className="opacity-0 select-none pointer-events-none">
        {remainingText}
      </span>
    </span>
  );
});
