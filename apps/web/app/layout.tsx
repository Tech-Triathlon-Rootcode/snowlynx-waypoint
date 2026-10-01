import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Waypoint delivery operations", template: "%s · Waypoint" },
  description: "SnowlynX delivery planning, loading, delivery and receipt system for Waypoint Group.",
  applicationName: "Waypoint",
};

export const viewport: Viewport = {
  themeColor: "#10383a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><a className="skip" href="#main">Skip to content</a>{children}</body></html>;
}
