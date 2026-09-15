import type { SVGProps } from "react";

export function CrownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
      <path d="m4 8 6.1 5.2L16 5l5.9 8.2L28 8l-2.2 14.5H6.2L4 8Z"
        fill="currentColor"/>
      <path d="M7 25.3h18M8 22.5h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="4" cy="8" r="1.8" fill="currentColor"/>
      <circle cx="16" cy="5" r="1.8" fill="currentColor"/>
      <circle cx="28" cy="8" r="1.8" fill="currentColor"/>
    </svg>
  );
}
