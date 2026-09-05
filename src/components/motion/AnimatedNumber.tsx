import * as React from "react";

export interface AnimatedNumberProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Target number to count up to */
  value: number;
  /** Duration in milliseconds (default: 800) */
  durationMs?: number;
  /** Optional delay before animation starts (default: 0) */
  delayMs?: number;
  /** Number of decimal places (default: 0) */
  decimals?: number;
  /** Optional prefix (e.g. "+") */
  prefix?: string;
  /** Optional suffix (e.g. "%") */
  suffix?: string;
  /** Additional CSS class */
  className?: string;
}

export const AnimatedNumber = React.memo(function AnimatedNumber({
  value,
  durationMs = 800,
  delayMs = 0,
  decimals = 0,
  prefix = "",
  suffix = "",
  className = "",
  ...props
}: AnimatedNumberProps) {
  const [currentValue, setCurrentValue] = React.useState(0);

  React.useEffect(() => {
    // Immediate on prefers-reduced-motion
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setCurrentValue(value);
      return;
    }

    let startTimestamp: number | null = null;
    let rafId: number | undefined;

    const timeoutId = window.setTimeout(() => {
      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const elapsed = timestamp - startTimestamp;
        const progress = Math.min(elapsed / Math.max(durationMs, 50), 1);

        // Standard ease-out cubic curve
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = eased * value;

        setCurrentValue(current);

        if (progress < 1) {
          rafId = window.requestAnimationFrame(step);
        } else {
          setCurrentValue(value);
        }
      };

      rafId = window.requestAnimationFrame(step);
    }, delayMs);

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [value, durationMs, delayMs]);

  const formatted = `${prefix}${currentValue.toFixed(decimals)}${suffix}`;

  return (
    <span className={`inline-block tabular-nums ${className}`} {...props}>
      {formatted}
    </span>
  );
});
