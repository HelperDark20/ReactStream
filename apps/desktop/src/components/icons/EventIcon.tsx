import { useEffect, useState, type CSSProperties, type ImgHTMLAttributes } from "react";
import giftUrl from "../../assets/icons/events/gift.svg";
import likeUrl from "../../assets/icons/events/like.svg";
import followUrl from "../../assets/icons/events/follow.svg";
import commentUrl from "../../assets/icons/events/comment.svg";
import shareUrl from "../../assets/icons/events/share.svg";
import memberUrl from "../../assets/icons/events/member.svg";
import superfanUrl from "../../assets/icons/events/superfan.svg";

export type EventIconType = "gift" | "like" | "follow" | "comment" | "share" | "member" | "superfan";
export type EventIconState = "default" | "active" | "selected";

const ICONS: Record<EventIconType, string> = { gift: giftUrl, like: likeUrl, follow: followUrl, comment: commentUrl, share: shareUrl, member: memberUrl, superfan: superfanUrl };

export interface EventIconProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> {
  type: EventIconType;
  size?: number;
  state?: EventIconState;
  alt?: string;
}

export function EventIcon({ type, size = 22, state = "default", alt = "", className = "", style, ...props }: EventIconProps) {
  const styleVars = { ...(style ?? {}), ["--event-icon-size" as string]: `${size}px` } as CSSProperties;
  return <img src={ICONS[type]} alt={alt} className={`rs-event-icon rs-event-icon-${state} ${className}`} style={styleVars} {...props} />;
}

const GIFT_CACHE_KEY = "reactstream_gift_catalog_v2";

export function GiftIcon({ gift, giftId, size = 24, state = "default", alt = "Regalo", className = "", style, ...props }: Omit<EventIconProps, "type"> & { gift?: { imageUrl?: string; name?: string } | null; giftId?: string }) {
  const [cachedGift, setCachedGift] = useState<{ imageUrl?: string; name?: string } | null>(gift ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (gift?.imageUrl) { setCachedGift(gift); return; }
    if (!giftId) { setCachedGift(null); return; }
    try {
      const raw = localStorage.getItem(GIFT_CACHE_KEY);
      const catalog = raw ? JSON.parse(raw) as Array<{ id: string; imageUrl?: string; name?: string }> : [];
      setCachedGift(catalog.find((item) => item.id === giftId) ?? null);
    } catch { setCachedGift(null); }
  }, [gift, giftId]);

  if (cachedGift?.imageUrl && !failed) {
    return <img src={cachedGift.imageUrl} alt={cachedGift.name ?? alt} width={size} height={size} className={`rs-gift-image rs-event-icon-${state} ${className}`} style={{ objectFit: "contain", ...style }} onError={() => setFailed(true)} {...props} />;
  }
  return <EventIcon type="gift" size={size} state={state} alt={alt} className={className} style={style} {...props} />;
}

export { ICONS as EVENT_ICON_URLS };
