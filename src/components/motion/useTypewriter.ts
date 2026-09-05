import * as React from "react";

export interface UseTypewriterOptions {
  text: string;
  speedMs?: number;
  delayMs?: number;
  onComplete?: () => void;
}

/**
 * Hook to progressively reveal text character-by-character.
 * Respects prefers-reduced-motion for instant reveal and accessibility.
 */
export function useTypewriter({
  text,
  speedMs = 24,
  delayMs = 0,
  onComplete,
}: UseTypewriterOptions) {
  const [displayedCount, setDisplayedCount] = React.useState(0);
  const [isTyping, setIsTyping] = React.useState(false);
  const onCompleteRef = React.useRef(onComplete);
  onCompleteRef.current = onComplete;

  React.useEffect(() => {
    // Check for reduced motion preference
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplayedCount(text.length);
      setIsTyping(false);
      onCompleteRef.current?.();
      return;
    }

    setDisplayedCount(0);
    setIsTyping(true);

    let intervalId: number | undefined;

    const timeoutId = window.setTimeout(() => {
      let current = 0;
      intervalId = window.setInterval(
        () => {
          current += 1;
          setDisplayedCount(current);
          if (current >= text.length) {
            window.clearInterval(intervalId);
            setIsTyping(false);
            onCompleteRef.current?.();
          }
        },
        Math.max(10, speedMs),
      );
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [text, speedMs, delayMs]);

  const displayedText = text.slice(0, displayedCount);
  const remainingText = text.slice(displayedCount);
  const isComplete = displayedCount >= text.length;

  return { displayedText, remainingText, isTyping, isComplete };
}
