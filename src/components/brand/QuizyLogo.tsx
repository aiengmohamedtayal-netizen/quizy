/**
 * Quizy Brand Logo Component
 *
 * Implements the new visual identity:
 * - Stylized "Q" symbol with vivid cyan-to-purple gradient loop
 * - Educational mortarboard (graduation cap) resting on the loop
 * - 3-tier quiz checklist inside the dark aperture
 * - Clean, bold modern "Quizy" wordmark with cyan dot
 * - Supporting Arabic brand badge and tagline
 *
 * Fully responsive, accessible, and optimized for both light & dark themes.
 */

import React from "react";
import { cn } from "@/lib/utils";

export type QuizyLogoVariant = "full" | "icon" | "compact" | "horizontal";

export interface QuizyLogoProps {
  /** Logo display variant */
  variant?: QuizyLogoVariant;
  /** Height in pixels (or icon dimension). Default depends on variant. */
  size?: number;
  /** Whether to show the "Turn Your Knowledge Into Progress" tagline */
  showTagline?: boolean;
  /** Whether to show the Arabic brand name "كويزي" alongside */
  showArabicBadge?: boolean;
  /** Additional CSS class names */
  className?: string;
  /** Accessible label */
  ariaLabel?: string;
  /** Click handler (e.g. for navigation) */
  onClick?: () => void;
}

/**
 * The core vector Mark: Stylized Q + Mortarboard + Checklist bullets
 */
export function QuizyMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 transition-transform duration-200 select-none", className)}
      aria-hidden="true"
    >
      <defs>
        {/* Outer Loop Gradient: Cyan -> Blue -> Purple */}
        <linearGradient
          id="quizyQGrad"
          x1="80"
          y1="110"
          x2="450"
          y2="450"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="30%" stopColor="#0EA5E9" />
          <stop offset="60%" stopColor="#2563EB" />
          <stop offset="88%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>

        {/* Sweeping Tail Ribbon Gradient */}
        <linearGradient
          id="quizyTailGrad"
          x1="240"
          y1="320"
          x2="440"
          y2="420"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#C084FC" />
        </linearGradient>

        {/* Mortarboard Diamond Gradient */}
        <linearGradient
          id="quizyCapGrad"
          x1="265"
          y1="55"
          x2="275"
          y2="185"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="60%" stopColor="#F8FAFC" />
          <stop offset="100%" stopColor="#CBD5E1" />
        </linearGradient>

        {/* Mortarboard Skullcap Gradient */}
        <linearGradient
          id="quizySkullCapGrad"
          x1="240"
          y1="140"
          x2="280"
          y2="195"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#E2E8F0" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>

        {/* Center Aperture Dark Cavity */}
        <radialGradient id="quizyAperture" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0F172A" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>

        {/* Soft Shadows for Depth */}
        <filter id="quizyDropShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#0F172A" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* Energy Rays at 10 o'clock */}
      <rect
        x="156"
        y="90"
        width="12"
        height="38"
        rx="6"
        transform="rotate(-35 156 90)"
        fill="#38BDF8"
        opacity="0.95"
      />
      <rect
        x="125"
        y="130"
        width="10"
        height="32"
        rx="5"
        transform="rotate(-65 125 130)"
        fill="#38BDF8"
        opacity="0.9"
      />

      {/* Main Q Torus Body */}
      <g filter="url(#quizyDropShadow)">
        <path
          d="M246 112
             C145 112 68 189 68 288
             C68 387 145 464 246 464
             C290 464 330 448 362 422
             C376 438 398 454 425 454
             C448 454 466 438 466 414
             C466 382 432 360 398 344
             C415 328 424 308 424 288
             C424 189 347 112 246 112 Z"
          fill="url(#quizyQGrad)"
        />

        {/* 3D Tail Ribbon */}
        <path
          d="M275 390
             C325 390 365 372 400 348
             C434 366 454 388 454 412
             C454 426 442 438 424 438
             C394 438 368 412 348 388
             C320 398 290 402 260 400
             Z"
          fill="url(#quizyTailGrad)"
        />

        {/* Dark Aperture Circle */}
        <circle
          cx="246"
          cy="288"
          r="92"
          fill="url(#quizyAperture)"
          stroke="#1E293B"
          strokeWidth="2.5"
        />
      </g>

      {/* 3-Tier Checklist Items inside Aperture */}
      <g transform="translate(192, 236)">
        {/* Row 1: White/Ice-Blue */}
        <circle cx="16" cy="14" r="8" fill="#F0F9FF" />
        <rect x="36" y="8" width="62" height="12" rx="6" fill="#F0F9FF" />

        {/* Row 2: Cyan */}
        <circle cx="16" cy="48" r="8" fill="#38BDF8" />
        <rect x="36" y="42" width="62" height="12" rx="6" fill="#38BDF8" />

        {/* Row 3: Purple */}
        <circle cx="16" cy="82" r="8" fill="#C084FC" />
        <rect x="36" y="76" width="46" height="12" rx="6" fill="#C084FC" />
      </g>

      {/* Mortarboard / Graduation Cap */}
      <g>
        {/* Skullcap Band */}
        <path
          d="M210 152
             C210 152 225 186 265 186
             C305 186 325 156 325 156
             C315 174 290 196 265 196
             C240 196 218 174 210 152 Z"
          fill="url(#quizySkullCapGrad)"
        />

        {/* Diamond Cap Top */}
        <polygon
          points="265,58 392,126 268,184 140,116"
          fill="url(#quizyCapGrad)"
          stroke="#CBD5E1"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <polyline
          points="140,116 268,184 392,126"
          stroke="#94A3B8"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Button & Hanging Tassel */}
        <ellipse cx="266" cy="120" rx="6" ry="4" fill="#E2E8F0" stroke="#64748B" strokeWidth="1" />
        <path
          d="M266 122 C290 126 345 142 368 170 C374 177 378 190 380 204"
          stroke="#E2E8F0"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
        />
        <rect
          x="375"
          y="198"
          width="9"
          height="24"
          rx="4.5"
          fill="#FFFFFF"
          stroke="#94A3B8"
          strokeWidth="1"
        />
      </g>
    </svg>
  );
}

/**
 * Main Quizy Logo Component with variants
 */
export function QuizyLogo({
  variant = "horizontal",
  size,
  showTagline = true,
  showArabicBadge = true,
  className,
  ariaLabel = "كويزي — Quizy",
  onClick,
}: QuizyLogoProps) {
  // 1. Icon Only
  if (variant === "icon") {
    const iconSize = size ?? 38;
    return (
      <span
        className={cn("inline-flex items-center justify-center shrink-0", className)}
        role="img"
        aria-label={ariaLabel}
        onClick={onClick}
      >
        <QuizyMark size={iconSize} />
      </span>
    );
  }

  // 2. Compact Variant (Icon + Clean Wordmark, ideal for mobile navbar & compact dialogs)
  if (variant === "compact") {
    const iconSize = size ?? 34;
    return (
      <div
        className={cn("inline-flex items-center gap-2.5 select-none cursor-pointer", className)}
        role="img"
        aria-label={ariaLabel}
        onClick={onClick}
      >
        <QuizyMark size={iconSize} />
        <div className="flex items-center gap-1.5">
          <span className="font-display text-xl font-bold tracking-tight text-foreground">
            Quizy
          </span>
          <span className="text-[11px] font-bold text-primary px-1.5 py-0.2 rounded-md bg-primary/10 border border-primary/20">
            كويزي
          </span>
        </div>
      </div>
    );
  }

  // 3. Full Vertical Variant (Hero & Splash)
  if (variant === "full") {
    const iconSize = size ?? 88;
    return (
      <div
        className={cn("flex flex-col items-center text-center select-none", className)}
        role="img"
        aria-label={ariaLabel}
        onClick={onClick}
      >
        <div className="relative mb-2">
          <QuizyMark size={iconSize} />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Quizy
          </span>
          <span className="text-xs font-bold text-primary px-2 py-0.5 rounded-lg bg-primary/10 border border-primary/25">
            كويزي
          </span>
        </div>
        {showTagline && (
          <div className="mt-1.5 space-y-1">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground tracking-wide">
              Turn Your Knowledge Into Progress
            </p>
            <div className="h-0.5 w-36 mx-auto rounded-full bg-gradient-to-r from-sky-400 via-primary to-purple-500" />
          </div>
        )}
      </div>
    );
  }

  // 4. Horizontal Variant (Default for Desktop Header & Navigation)
  const iconSize = size ?? 40;
  return (
    <div
      className={cn("flex items-center gap-3 select-none text-right", className)}
      role="img"
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <div className="relative shrink-0">
        <QuizyMark size={iconSize} />
      </div>

      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-2">
          <span className="text-xl sm:text-2xl font-display font-extrabold text-foreground tracking-tight leading-none">
            Quizy
          </span>
          {showArabicBadge && (
            <span className="text-[11px] font-bold text-primary px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/25 leading-none">
              كويزي
            </span>
          )}
        </div>
        {showTagline && (
          <p className="text-[11px] text-muted-foreground font-body-medium hidden sm:block mt-1 leading-none">
            Turn Your Knowledge Into Progress
          </p>
        )}
      </div>
    </div>
  );
}
