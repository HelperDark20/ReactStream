import type { SVGProps } from "react";

export function VolumeFilledIcon({ size = 22.5, className = "", ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Bocina en contorno, sin relleno */}
      <path
        d="M4 13H8.5L14.5 7.5V24.5L8.5 19H4C3.45 19 3 18.55 3 18V14C3 13.45 3.45 13 4 13Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Ondas de audio */}
      <path
        d="M19 11C20.5 12.5 21.3 14.15 21.3 16C21.3 17.85 20.5 19.5 19 21"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M23 7.5C25.6 9.9 27 12.75 27 16C27 19.25 25.6 22.1 23 24.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
