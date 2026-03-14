import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Providers } from "@/components/providers";
import { SwRegister } from "@/components/pwa/sw-register";

export const metadata: Metadata = {
  title: "Telecom NMS",
  description: "ISP wireless network operations platform",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Telecom NMS Field",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          <SwRegister />
          {children}
        </Providers>
      </body>
    </html>
  );
}
