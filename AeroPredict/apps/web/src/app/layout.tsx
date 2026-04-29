import type { Metadata } from "next";
import { WalletContextProvider } from "@/components/WalletContextProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlightSense AI | Predictive Disruption Intelligence",
  description: "AI-powered flight disruption prediction using prediction markets and proactive passenger outreach.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased grid-pattern">
        <WalletContextProvider>
          {children}
        </WalletContextProvider>
      </body>
    </html>
  );
}
