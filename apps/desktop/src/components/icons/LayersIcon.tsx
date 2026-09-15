import type { SVGProps } from "react";

export function LayersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
      <path d="m16 4 12 7-12 7L4 11l12-7Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round"/>
      <path d="m6.2 16 9.8 5.8 9.8-5.8M6.2 21.2 16 27l9.8-5.8"
        stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round"/>
    </svg>
  );
}
