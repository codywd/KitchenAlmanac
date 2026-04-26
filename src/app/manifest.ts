import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#fff7e8",
    description:
      "KitchenAlmanac keeps household meals, shopping, recipes, and feedback in sync.",
    display: "standalone",
    icons: [
      {
        purpose: "any",
        sizes: "any",
        src: "/icons/kitchen-almanac-icon.svg",
        type: "image/svg+xml",
      },
      {
        purpose: "maskable",
        sizes: "any",
        src: "/icons/kitchen-almanac-maskable.svg",
        type: "image/svg+xml",
      },
    ],
    name: "KitchenAlmanac",
    short_name: "KitchenAlmanac",
    start_url: "/calendar",
    theme_color: "#fff7e8",
  };
}
