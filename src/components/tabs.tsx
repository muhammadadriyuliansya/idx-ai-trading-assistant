"use client";

import { motion } from "framer-motion";
import { 
  Search, 
  BarChart3, 
  ScanLine,
  GitCompare,
  Layers,
  Briefcase,
  Sun,
  Settings as SettingsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type TabId = "brief" | "scanner" | "analysis" | "positions" | "comparison" | "timeframe" | "breadth" | "settings";

export interface TabItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

export const TABS: TabItem[] = [
  { id: "brief", label: "Brief", icon: <Sun className="h-4 w-4" /> },
  { id: "scanner", label: "Scanner", icon: <Search className="h-4 w-4" /> },
  { id: "analysis", label: "Analisis", icon: <BarChart3 className="h-4 w-4" /> },
  { id: "positions", label: "Posisi", icon: <Briefcase className="h-4 w-4" /> },
  { id: "comparison", label: "Bandingkan", icon: <GitCompare className="h-4 w-4" /> },
  { id: "timeframe", label: "Multi Timeframe", icon: <ScanLine className="h-4 w-4" /> },
  { id: "breadth", label: "Kondisi Market", icon: <Layers className="h-4 w-4" /> },
  { id: "settings", label: "Pengaturan", icon: <SettingsIcon className="h-4 w-4" /> },
];

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-zinc-900/50 p-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all",
            activeTab === tab.id
              ? "bg-zinc-800 text-zinc-100 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
          )}
        >
          {tab.icon}
          <span className="hidden sm:inline">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

interface TabContentProps {
  activeTab: TabId;
  children: React.ReactNode;
}

export function TabContent({ activeTab, children }: TabContentProps) {
  return (
    <motion.div
      key={activeTab}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}
