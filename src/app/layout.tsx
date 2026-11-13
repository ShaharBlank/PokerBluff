import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BLUFF — Read the room. Play your hand.",
  description:
    "A little poker. A lot of nerve. Bring your friends to the table for a quick game of BLUFF, wherever they are.",
  applicationName: "BLUFF",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
