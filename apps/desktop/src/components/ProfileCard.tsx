import { useAppStore } from "../stores/app.store";
import { UserIcon } from "./icons";

export default function ProfileCard() {
  const { tiktokUsername, tiktokDisplayName, tiktokAvatarUrl, tiktokStatus, sessionActive } = useAppStore();
  const connected = tiktokStatus === "CONNECTED" || Boolean(tiktokUsername || tiktokAvatarUrl);
  const name = tiktokDisplayName || tiktokUsername || "David R";
  const username = tiktokUsername ? `@${tiktokUsername}` : "@usuario";
  const initials = (name || "DR").replace(/[^a-zA-ZÀ-ÿ]/g, "").slice(0, 2).toUpperCase() || "DR";

  return (
    <div className={`rs-profile-card ${connected ? "connected" : ""} ${sessionActive ? "live" : ""}`}>
      <div className="rs-profile-avatar">
        {tiktokAvatarUrl ? (
          <img src={tiktokAvatarUrl} alt="Foto de perfil" referrerPolicy="no-referrer" />
        ) : connected ? (
          <span>{initials}</span>
        ) : (
          <UserIcon />
        )}
        {connected && <span className="rs-profile-status-dot" />}
      </div>
      <div className="rs-profile-copy">
        <strong>{name}</strong>
        <span>{username}</span>
      </div>
    </div>
  );
}
