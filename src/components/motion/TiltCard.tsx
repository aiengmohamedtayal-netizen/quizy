import * as React from "react";

export interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Maximum tilt angle in degrees (default: 2.5) */
  maxTilt?: number;
  /** Enable spotlight radial glow (default: true) */
  spotlight?: boolean;
  className?: string;
}

export const TiltCard = React.memo(function TiltCard({
  children,
  maxTilt = 2.5,
  spotlight = true,
  className = "",
  style,
  ...props
}: TiltCardProps) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = React.useState({ x: 0, y: 0 });
  const [spotlightPos, setSpotlightPos] = React.useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = React.useState(false);

  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current) return;
      // Skip on touch/pointer coarse
      if (
        window.matchMedia("(pointer: coarse)").matches ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }

      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Subtle tilt: rotateX controlled by vertical offset, rotateY by horizontal offset
      const rotateX = ((y - centerY) / centerY) * -maxTilt;
      const rotateY = ((x - centerX) / centerX) * maxTilt;

      setTilt({ x: rotateX, y: rotateY });
      setSpotlightPos({
        x: (x / rect.width) * 100,
        y: (y / rect.height) * 100,
      });
    },
    [maxTilt],
  );

  const handleMouseEnter = React.useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = React.useCallback(() => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0 });
  }, []);

  const transformStyle: React.CSSProperties = {
    transform: isHovered
      ? `perspective(1000px) rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg) translateZ(2px)`
      : "perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)",
    transition: isHovered
      ? "transform 0.08s ease-out"
      : "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
    ...style,
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={transformStyle}
      className={`relative overflow-hidden ${className}`}
      {...props}
    >
      {spotlight && isHovered && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-px transition-opacity duration-300 opacity-60 z-10"
          style={{
            background: `radial-gradient(400px circle at ${spotlightPos.x}% ${spotlightPos.y}%, rgba(var(--color-primary-rgb, 99 102 241), 0.08), transparent 80%)`,
          }}
        />
      )}
      {children}
    </div>
  );
});
