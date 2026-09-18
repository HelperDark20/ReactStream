import type { SVGProps } from "react";

interface SoundArtworkProps extends SVGProps<SVGSVGElement> {
  playing?: boolean;
  size?: number | string;
}

export default function SoundArtwork({
  playing = false,
  size = 150,
  className = "",
  ...props
}: SoundArtworkProps) {
  return (
    <svg
      className={`sound-artwork ${playing ? "is-playing" : ""} ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 180 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id="soundNoteFill" x1="94" y1="42" x2="94" y2="126" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#DCE7E0" />
        </linearGradient>

        <linearGradient id="soundRibbonA" x1="18" y1="124" x2="162" y2="120" gradientUnits="userSpaceOnUse">
          <stop stopColor="#39FF14" stopOpacity="0.08" />
          <stop offset="0.45" stopColor="#39FF14" stopOpacity="0.38" />
          <stop offset="1" stopColor="#39FF14" stopOpacity="0.08" />
        </linearGradient>

        <linearGradient id="soundRibbonB" x1="18" y1="136" x2="162" y2="132" gradientUnits="userSpaceOnUse">
          <stop stopColor="#39FF14" stopOpacity="0.03" />
          <stop offset="0.5" stopColor="#39FF14" stopOpacity="0.24" />
          <stop offset="1" stopColor="#39FF14" stopOpacity="0.04" />
        </linearGradient>

        <radialGradient id="soundAura" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
          gradientTransform="translate(91 92) rotate(90) scale(72)">
          <stop stopColor="#39FF14" stopOpacity="0.12" />
          <stop offset="0.64" stopColor="#39FF14" stopOpacity="0.035" />
          <stop offset="1" stopColor="#39FF14" stopOpacity="0" />
        </radialGradient>

        <filter id="soundNoteGlow" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="4.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="soundRibbonGlow" x="-50%" y="-70%" width="200%" height="240%">
          <feGaussianBlur stdDeviation="2.8" result="ribbonBlur" />
          <feMerge>
            <feMergeNode in="ribbonBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Transparent aura; the parent glass remains visible through it. */}
      <circle className="sound-artwork-aura" cx="90" cy="92" r="72" fill="url(#soundAura)" />

      {/* Broad flowing audio ribbons, matching the approved proposal. */}
      <g className="sound-artwork-waves" filter="url(#soundRibbonGlow)">
        <path
          d="M12 123C34 102 50 102 68 121C86 140 101 144 118 125C134 108 148 96 168 111"
          stroke="url(#soundRibbonA)"
          strokeWidth="12"
          strokeLinecap="round"
          opacity="0.75"
        />
        <path
          d="M8 137C31 119 47 119 65 136C83 153 100 155 119 139C136 124 151 116 171 127"
          stroke="url(#soundRibbonB)"
          strokeWidth="7"
          strokeLinecap="round"
          opacity="0.9"
        />
        <path
          d="M18 112C38 98 53 100 69 113C85 127 102 128 118 112C132 98 149 91 164 101"
          stroke="#39FF14"
          strokeOpacity="0.10"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>

      {/* Large, clean filled music note. */}
      <g className="sound-artwork-note" filter="url(#soundNoteGlow)">
        <path
          d="M96 38V102"
          stroke="url(#soundNoteFill)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M96 38L132 30V43L96 51Z"
          fill="url(#soundNoteFill)"
        />
        <ellipse
          cx="76"
          cy="112"
          rx="22"
          ry="17"
          transform="rotate(-16 76 112)"
          fill="url(#soundNoteFill)"
        />
      </g>

      {/* Playback sparks: hidden at rest, revealed while the MP3 is playing. */}
      <g className="sound-artwork-sparks">
        <circle cx="53" cy="58" r="2.4" />
        <circle cx="132" cy="61" r="2.2" />
        <circle cx="145" cy="87" r="1.8" />
        <circle cx="40" cy="91" r="1.7" />
        <circle cx="126" cy="43" r="1.6" />
      </g>
    </svg>
  );
}
