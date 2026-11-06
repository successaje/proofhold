import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Proofhold",
    short_name: "Proofhold",
    description: "A PayPal payment that is held until the agreed proof arrives.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f6f4ef",
    theme_color: "#0d5c4e",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
