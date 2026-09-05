import { useEffect, useRef } from "react";

type FloatingVectorProps = {
  className?: string;
  intensity?: number;
};

export function FloatingVector({ className = "", intensity = 8 }: FloatingVectorProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    let frame = 0;
    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = (event.clientX / window.innerWidth - 0.5) * intensity;
        const y = (event.clientY / window.innerHeight - 0.5) * intensity;
        node.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, [intensity]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none select-none will-change-transform motion-safe:transition-transform motion-safe:duration-300 motion-reduce:transform-none ${className}`}
    >
      <svg viewBox="0 0 240 180" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="quizy-ribbon" x1="24" y1="18" x2="214" y2="156" gradientUnits="userSpaceOnUse">
            <stop stopColor="#22D3EE" />
            <stop offset="1" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
        <rect x="30" y="26" width="148" height="104" rx="18" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeOpacity="0.18" />
        <path d="M58 58h84M58 80h62M58 102h44" stroke="url(#quizy-ribbon)" strokeWidth="8" strokeLinecap="round" />
        <path d="m169 59 12 12 22-28" stroke="url(#quizy-ribbon)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="194" cy="122" r="22" fill="url(#quizy-ribbon)" fillOpacity="0.16" />
        <path d="M185 122h18M194 113v18" stroke="url(#quizy-ribbon)" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </div>
  );
}
