import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Waypoint delivery operations",
    short_name: "Waypoint",
    description: "Connected delivery operations for dispatchers, loaders, drivers and store managers.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f6f3",
    theme_color: "#10383a",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
