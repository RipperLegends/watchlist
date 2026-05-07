import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/app/globals.css";
import { AppHeader } from "@/components/app-header";
import { SiteFooter } from "@/components/site-footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"]
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"]
});

export const metadata: Metadata = {
  title: "Watchlist",
  description: "Каталог фільмів, серіалів, друзів і повідомлень.",
  manifest: "/site.webmanifest",
  icons: {
    icon: "/favicon.ico"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AppHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
