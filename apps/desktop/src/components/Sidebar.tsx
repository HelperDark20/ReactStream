import { useAppStore, type ActivePage } from "../stores/app.store";
import { ZapIcon, LayersIcon, MusicIcon, CrownIcon } from "./icons";
import type { ComponentType, SVGProps } from "react";
import completeLogo from "../assets/reactstream-complete-logo.svg";

interface NavItem {
  id: ActivePage;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  pro?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "actions",  icon: ZapIcon,    label: "Acciones y\nEventos" },
  { id: "overlays", icon: LayersIcon, label: "Overlays" },
  { id: "sounds",   icon: MusicIcon,  label: "Sonidos" },
  { id: "pro",      icon: CrownIcon,  label: "Pro", pro: true },
];

export default function Sidebar() {
  const { activePage, setActivePage } = useAppStore();

  return (
    <aside className="rs-sidebar glass-sidebar">
      <div className="glass-sidebar-logo" onClick={() => setActivePage("home")} role="button" tabIndex={0}>
        <img className="glass-sidebar-complete-logo" src={completeLogo} alt="ReactStream" draggable={false} />
      </div>
      <nav className="sidebar-nav">
        <div className="sidebar-top-items">
          {NAV_ITEMS.map((item) => {
            const isActive = activePage === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`glass-sidebar-item ${isActive ? "active" : ""}`}
                onClick={() => setActivePage(item.id)}
              >
                <Icon className={`sidebar-icon-svg ${item.pro ? "sidebar-pro" : ""}`} />
                <span className="sidebar-label">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
