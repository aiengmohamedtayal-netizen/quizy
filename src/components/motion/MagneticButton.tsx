import * as React from "react";

export interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  /** Maximum magnetic pull distance in pixels (default: 5) */
  maxPull?: number;
  className?: string;
}

export const MagneticButton = React.memo(function MagneticButton({
  children,
  maxPull = 5,
  className = "",
  style,
  ...props
}: MagneticButtonProps) {
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = React.useState(false);

  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!buttonRef.current || props.disabled) return;
      if (
        window.matchMedia("(pointer: coarse)").matches ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }

      const rect = buttonRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = (e.clientX - centerX) / (rect.width / 2);
      const deltaY = (e.clientY - centerY) / (rect.height / 2);

      setOffset({
        x: Math.max(-maxPull, Math.min(maxPull, deltaX * maxPull)),
        y: Math.max(-maxPull, Math.min(maxPull, deltaY * maxPull)),
      });
    },
    [maxPull, props.disabled],
  );

  const handleMouseEnter = React.useCallback(() => {
    if (!props.disabled) setIsHovered(true);
  }, [props.disabled]);

  const handleMouseLeave = React.useCallback(() => {
    setIsHovered(false);
    setOffset({ x: 0, y: 0 });
  }, []);

  const transformStyle: React.CSSProperties = {
    transform: isHovered
      ? `translate3d(${offset.x.toFixed(1)}px, ${offset.y.toFixed(1)}px, 0)`
      : "translate3d(0, 0, 0)",
    transition: isHovered
      ? "transform 0.1s ease-out"
      : "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
    ...style,
  };

  return (
    <button
      ref={buttonRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={transformStyle}
      className={`btn-tactile active:scale-[0.97] transition-transform ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});
