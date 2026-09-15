import { useState } from "react";
import KeystrokePage from "./actions/KeystrokePage";
import MediasPage from "./actions/MediasPage";
import AutomationsPage from "./actions/AutomationsPage";

type Tab = "keystroke" | "medias" | "automations";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "keystroke", label: "KeyStroke", icon: "⌨" },
  { id: "medias", label: "Medios y Overlays", icon: "🎬" },
  { id: "automations", label: "Automatizaciones", icon: "⚡" },
];

export default function ActionsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("keystroke");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 4, padding: "10px 14px 0",
        borderBottom: "1px solid var(--rs-border)",
        background: "rgba(6,9,7,0.6)",
        flexShrink: 0,
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "8px 18px",
                borderRadius: "8px 8px 0 0",
                border: "1px solid transparent",
                borderBottom: "none",
                background: isActive ? "rgba(57,255,20,0.08)" : "transparent",
                borderColor: isActive ? "var(--rs-border-green)" : "transparent",
                color: isActive ? "var(--rs-green)" : "var(--rs-text-secondary)",
                fontWeight: isActive ? 700 : 400,
                fontSize: 13,
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: 7,
                transition: "all 0.15s",
                marginBottom: isActive ? -1 : 0,
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {activeTab === "keystroke" && <KeystrokePage />}
        {activeTab === "medias" && <MediasPage />}
        {activeTab === "automations" && <AutomationsPage />}
      </div>
    </div>
  );
}
