import { useState } from "react";
import type { ImgHTMLAttributes } from "react";
import giftFallback from "../../assets/icons/events/gift.svg";

export interface GiftIconData { id?: string; name?: string; imageUrl?: string | null; }

export function GiftIcon({ gift, size = 22, className = "", ...props }: Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & { gift?: GiftIconData | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = gift?.imageUrl && !failed ? gift.imageUrl : giftFallback;
  return <img src={src} alt={gift?.name ? `Regalo ${gift.name}` : "Regalo"} width={size} height={size} className={`rs-gift-icon ${className}`} onError={() => setFailed(true)} {...props} />;
}
