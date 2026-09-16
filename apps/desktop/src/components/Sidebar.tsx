import { useAppStore, type ActivePage } from "../stores/app.store";
import { ZapIcon, LayersIcon, MusicIcon, CrownIcon, SettingsIcon } from "./icons";
import type { ComponentType, SVGProps } from "react";

interface NavItem { id: ActivePage; icon: ComponentType<SVGProps<SVGSVGElement>>; label: string; pro?: boolean; bottom?: boolean; }
const NAV_ITEMS: NavItem[] = [
  { id: "actions", icon: ZapIcon, label: "Acciones y\nEventos" },
  { id: "overlays", icon: LayersIcon, label: "Overlays" },
  { id: "sounds", icon: MusicIcon, label: "Sonidos" },
  { id: "pro", icon: CrownIcon, label: "Pro", pro: true },
  { id: "settings", icon: SettingsIcon, label: "Config", bottom: true },
];

export default function Sidebar() {
  const { activePage, setActivePage } = useAppStore();
  const topItems = NAV_ITEMS.filter((i) => !i.bottom);
  const bottomItems = NAV_ITEMS.filter((i) => i.bottom);
  return (
    <aside className="rs-sidebar">
      <nav className="sidebar-nav" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ flex: 1 }}>
          {topItems.map((item) => {
            const isActive = activePage === item.id;
            const Icon = item.icon;
            return (
              <button key={item.id} className={`sidebar-item ${isActive ? "active" : ""}`} onClick={() => setActivePage(item.id)}>
                <Icon className={`sidebar-icon-svg ${item.pro ? "sidebar-pro" : ""}`} />
                <span className="sidebar-label">{item.label}</span>
              </button>
            );
          })}
        </div>
        <div>
          {bottomItems.map((item) => {
            const isActive = activePage === item.id;
            const Icon = item.icon;
            return (
              <button key={item.id} className={`sidebar-item ${isActive ? "active" : ""}`} onClick={() => setActivePage(item.id)}>
                <Icon className="sidebar-icon-svg" />
                <span className="sidebar-label">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
