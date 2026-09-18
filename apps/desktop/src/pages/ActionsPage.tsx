import { useState } from "react";
import KeystrokePage from "./actions/KeystrokePage";
import MediasPage from "./actions/MediasPage";
import AutomationsPage from "./actions/AutomationsPage";
import { UIIcon, ZapIcon } from "../components/icons";
import background from "../assets/reactstream-background.svg";

type Tab = "keystroke" | "medias" | "automations";

const TABS: { id: Tab; label: string; icon: "keyboard" | "layers" | "zap" }[] = [
  { id: "keystroke", label: "Keystroke", icon: "keyboard" },
  { id: "medias", label: "Medios y Overlays", icon: "layers" },
  { id: "automations", label: "Automatizaciones", icon: "zap" },
];

export default function ActionsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("keystroke");

  return (
    <section className="actions-module-shell">
      <img
        className="actions-module-background"
        src={background}
        alt=""
        draggable={false}
      />
      <header className="actions-module-header">
        <div className="actions-module-title-row">
          <ZapIcon className="actions-module-title-icon" />
          <div>
            <h1>Acciones y Eventos</h1>
            <p>Gestiona lo que ocurre durante tu LIVE</p>
          </div>
        </div>
      </header>

      <div className="actions-module-card">
        <nav className="actions-module-tabs" aria-label="Acciones y Eventos">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`actions-module-tab ${isActive ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="actions-module-tab-icon"><UIIcon name={tab.icon} size={14} /></span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="actions-module-content">
          {activeTab === "keystroke" && <KeystrokePage />}
          {activeTab === "medias" && <MediasPage />}
          {activeTab === "automations" && <AutomationsPage />}
        </div>
      </div>
    </section>
  );
}
