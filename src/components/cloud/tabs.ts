import { AlarmClock, History, LayoutGrid, Plug, Share2, Sparkles, type LucideIcon } from "lucide-react";

export type ExportTab = "overview" | "destinations" | "templates" | "schedules" | "share" | "history";

export const EXPORT_TABS: { value: ExportTab; label: string; icon: LucideIcon }[] = [
  { value: "overview", label: "Overview", icon: LayoutGrid },
  { value: "destinations", label: "Destinations", icon: Plug },
  { value: "templates", label: "Templates", icon: Sparkles },
  { value: "schedules", label: "Schedules", icon: AlarmClock },
  { value: "share", label: "Share", icon: Share2 },
  { value: "history", label: "History", icon: History },
];

export function isExportTab(value: string | null): value is ExportTab {
  return EXPORT_TABS.some((tab) => tab.value === value);
}
