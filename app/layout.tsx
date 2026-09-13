import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/app/globals.css";
import { AppHeader } from "@/components/app-header";
import { SiteFooter } from "@/components/site-footer";
import { MobileNav } from "@/components/mobile-nav";
import { getCurrentLocale, localeToHtmlLang } from "@/lib/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"]
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"]
});

export const metadata: Metadata = {
  title: {
    template: "%s | Watchlist",
    default: "Watchlist - Твій соціальний кінокаталог",
  },
  description: "Організуй свої улюблені фільми та серіали. Обговорюй новинки з друзями, створюй спільні списки та знаходь нові ідеї для кіновечора.",
  manifest: "/site.webmanifest",
  icons: {
    icon: "/favicon.ico",
    apple: "/icon.png",
  },
  openGraph: {
    title: "Watchlist - Твій соціальний кінокаталог",
    description: "Організуй свої улюблені фільми та серіали. Обговорюй новинки з друзями, створюй спільні списки та знаходь нові ідеї для кіновечора.",
    url: "https://watchlist.app",
    siteName: "Watchlist",
    images: [
      {
        url: "https://watchlist.app/og-image.png", // Замінити на реальний URL у продакшені
        width: 1200,
        height: 630,
        alt: "Watchlist Cover",
      },
    ],
    locale: "uk_UA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Watchlist - Твій соціальний кінокаталог",
    description: "Зберігай, оцінюй та обговорюй кіно з друзями.",
    images: ["https://watchlist.app/og-image.png"],
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getCurrentLocale();

  return (
    <html lang={localeToHtmlLang[locale]} suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen flex flex-col`}>
        <AppHeader />
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <SiteFooter />
        <MobileNav />
      </body>
    </html>
  );
}
