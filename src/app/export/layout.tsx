import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Export & Sync",
  description: "Connect destinations, schedule backups, and share reports.",
};

export default function ExportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
