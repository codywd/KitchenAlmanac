import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KitchenAlmanac",
  },
  applicationName: "KitchenAlmanac",
  description: "Private household calendar, shopping, cookbook, and planning API.",
  manifest: "/manifest.webmanifest",
  title: "KitchenAlmanac",
};

export const viewport: Viewport = {
  themeColor: "#fff7e8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
