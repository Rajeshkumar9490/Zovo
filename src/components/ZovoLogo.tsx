import React from 'react';

interface ZovoLogoProps {
  className?: string;
  size?: number | string;
  variant?: 'mark' | 'tile' | 'hero';
}

/**
 * Exact Vector Reproduction of the Zovo Isometric Pinwheel Diamond Symbol.
 * 4 cycling gradient capsules with authentic pinwheel overlap and dark magenta shadows.
 */
export function ZovoLogo({
  className = 'w-5 h-5',
  size,
  variant = 'mark',
}: ZovoLogoProps) {
  const logoContent = (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full select-none"
      aria-label="Zovo Symbol"
    >
      <defs>
        {/* Master Gradient for each cycling blade: Vibrant Pink -> Deep Magenta -> Wine Shadow */}
        <linearGradient id="zovo-blade-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FF0878" />
          <stop offset="25%" stopColor="#F0006C" />
          <stop offset="65%" stopColor="#B30050" />
          <stop offset="100%" stopColor="#40001D" />
        </linearGradient>

        {/* Soft shadow cast by overlapping cap onto the blade below */}
        <linearGradient id="zovo-overlap-shadow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1E000D" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#1E000D" stopOpacity="0" />
        </linearGradient>

        {/* Base Pill Geometry: Length 45, Height 21, Left Cap R=10.5 */}
        <g id="zovo-blade">
          {/* Main Blade with Gradient */}
          <path
            d="M 10.5 0 L 45 0 L 45 21 L 10.5 21 A 10.5 10.5 0 0 1 10.5 0 Z"
            fill="url(#zovo-blade-grad)"
          />
          {/* Contact shadow at the tail where next pill overlaps */}
          <rect
            x="24"
            y="0"
            width="21"
            height="21"
            fill="url(#zovo-overlap-shadow)"
          />
        </g>

        {/* Head Cap for cyclical top-layer stitching */}
        <path
          id="zovo-blade-head"
          d="M 10.5 0 L 21 0 L 21 21 L 10.5 21 A 10.5 10.5 0 0 1 10.5 0 Z"
          fill="#FF0878"
        />
      </defs>

      {/* Group centered at (50, 50) */}
      <g transform="translate(50, 50)">
        {/* 1. Top Blade: starts at top, goes down-right (45 deg) */}
        <g transform="rotate(45) translate(-32, -32.5)">
          <use href="#zovo-blade" />
        </g>

        {/* 2. Right Blade: starts at right, goes down-left (135 deg) */}
        <g transform="rotate(135) translate(-32, -32.5)">
          <use href="#zovo-blade" />
        </g>

        {/* 3. Bottom Blade: starts at bottom, goes up-left (225 deg) */}
        <g transform="rotate(225) translate(-32, -32.5)">
          <use href="#zovo-blade" />
        </g>

        {/* 4. Left Blade: starts at left, goes up-right (315 deg) */}
        <g transform="rotate(315) translate(-32, -32.5)">
          <use href="#zovo-blade" />
        </g>

        {/* Re-stitch the Top Blade's Head Cap so it overlaps the Left Blade's tail (Complete Pinwheel Loop) */}
        <g transform="rotate(45) translate(-32, -32.5)">
          <use href="#zovo-blade-head" />
        </g>
      </g>
    </svg>
  );

  const wrapper = (
    <div
      className={`relative inline-flex items-center justify-center flex-shrink-0 ${className}`}
      style={size ? { width: size, height: size } : undefined}
    >
      {logoContent}
    </div>
  );

  if (variant === 'tile') {
    return (
      <div className="w-8 h-8 rounded-xl bg-[#090D1A] border border-pink-500/20 flex items-center justify-center shadow-xs overflow-hidden">
        <ZovoLogo className="w-5 h-5" />
      </div>
    );
  }

  if (variant === 'hero') {
    return (
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#090D1A] border border-pink-500/30 shadow-lg shadow-pink-950/20">
        <ZovoLogo className="w-10 h-10" />
      </div>
    );
  }

  return wrapper;
}
