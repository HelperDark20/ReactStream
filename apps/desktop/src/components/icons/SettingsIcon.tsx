import type { SVGProps } from "react";

export function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
      <path d="M13.1 3.8h5.8l.9 3.1c.7.2 1.4.6 2.1 1l3-1.1 4.1 4.1-1.2 3c.4.7.7 1.4.9 2.2l3.1.9v5.8l-3.1.9c-.2.8-.5 1.5-.9 2.2l1.2 3-4.1 4.1-3-1.1c-.7.4-1.4.7-2.1.9l-.9 3.1h-5.8l-.9-3.1c-.8-.2-1.5-.5-2.2-.9l-3 1.1-4.1-4.1 1.1-3c-.4-.7-.7-1.4-.9-2.2L0 22.8V17l3.1-.9c.2-.8.5-1.5.9-2.2l-1.1-3L7 6.8l3 1.1c.7-.4 1.4-.7 2.2-1l.9-3.1Z"
        fill="currentColor" transform="translate(0 -1.5) scale(.9)"/>
      <circle cx="16" cy="16" r="4.1" fill="#090b0a"/>
    </svg>
  );
}
