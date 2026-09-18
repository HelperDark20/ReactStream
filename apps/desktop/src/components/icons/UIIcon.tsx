import type { ReactNode, SVGProps } from "react";
import warningAutoItUrl from "../../assets/icons/ui/warning-autoit.svg";
import saveChangesUrl from "../../assets/icons/ui/save-changes.svg";
import deleteUrl from "../../assets/icons/ui/delete.svg";
import downloadAutoItUrl from "../../assets/icons/ui/download-autoit.svg";

export type UIIconName =
  | "keyboard"
  | "layers"
  | "zap"
  | "warning"
  | "download"
  | "play"
  | "clock"
  | "check"
  | "trash"
  | "more"
  | "x"
  | "copy"
  | "image"
  | "audio"
  | "sparkles"
  | "film"
  | "volumeOff"
  | "volume"
  | "pause"
  | "plus"
  | "gift";

const paths: Record<UIIconName, ReactNode> = {
  keyboard: <><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M6 9h.01M9 9h.01M12 9h.01M15 9h.01M18 9h.01M6 12h.01M9 12h.01M12 12h.01M15 12h.01M18 12h.01M7 15h10"/></>,
  layers: <><path d="m12 3 8.5 4.5L12 12 3.5 7.5 12 3Z"/><path d="m3.5 12 8.5 4.5 8.5-4.5"/><path d="m3.5 16.5 8.5 4.5 8.5-4.5"/></>,
  zap: <path d="m13 2-9 11h7l-1 9 9-12h-7l1-8Z"/>,
  warning: <><path d="M12 3.4 21 19H3L12 3.4Z"/><path d="M12 8.5v5.2M12 16.7h.01"/></>,
  download: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 20h16"/></>,
  play: <path d="m8 5 11 7-11 7V5Z"/>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  check: <path d="m5 12 4 4 10-10"/>,
  trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></>,
  x: <><path d="m6 6 12 12M18 6 6 18"/></>,
  copy: <><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.4"/><path d="m4.5 17 5-5 3.5 3 2.5-2.5 5 4.5"/></>,
  audio: <><path d="M5 9v6h4l5 4V5L9 9H5Z"/><path d="M18 9.5a4 4 0 0 1 0 5M20 7a7 7 0 0 1 0 10"/></>,
  sparkles: <><path d="m12 3 1.3 4.7L18 9l-4.7 1.3L12 15l-1.3-4.7L6 9l4.7-1.3L12 3Z"/><path d="m19 14 .6 2.4L22 17l-2.4.6L19 20l-.6-2.4L16 17l2.4-.6L19 14Z"/></>,
  film: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M17 9h4M3 15h4M17 15h4"/></>,
  volumeOff: <><path d="M5 9v6h4l5 4V5L9 9H5Z"/><path d="m18 10 3 4M21 10l-3 4"/></>,
  volume: <><path d="M5 9v6h4l5 4V5L9 9H5Z"/><path d="M18 9.5a4 4 0 0 1 0 5"/></>,
  pause: <><rect x="7" y="5" width="3" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="5" width="3" height="14" rx="1" fill="currentColor" stroke="none"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  gift: <><path d="M20 12v10H4V12"/><rect x="2" y="7" width="20" height="5" rx="1"/><path d="M12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></>,
};

export interface UIIconProps extends SVGProps<SVGSVGElement> {
  name: UIIconName;
  size?: number;
}

export function UIIcon({ name, size = 16, strokeWidth = 1.8, className = "", ...props }: UIIconProps) {
  const assetByName: Partial<Record<UIIconName, string>> = {
    warning: warningAutoItUrl,
    download: downloadAutoItUrl,
    trash: deleteUrl,
    check: saveChangesUrl,
  };

  const assetUrl = assetByName[name];

  if (assetUrl) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={`rs-ui-icon rs-ui-icon-${name} ${className}`.trim()}
        {...props}
      >
        <image href={assetUrl} x="0" y="0" width="24" height="24" preserveAspectRatio="xMidYMid meet" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`rs-ui-icon rs-ui-icon-${name} ${className}`.trim()}
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
