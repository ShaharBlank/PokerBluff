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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          id="bluff-theme-init"
          dangerouslySetInnerHTML={{
            __html: `(()=>{let t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';try{const s=localStorage.getItem('bluff:theme');if(s==='dark'||s==='light')t=s}catch{}document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
