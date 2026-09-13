import Link from "next/link";
import { footerGroups } from "@/lib/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getCurrentLocale, localeLabels, t } from "@/lib/i18n";

export async function SiteFooter() {
  const locale = await getCurrentLocale();

  return (
    <footer className="relative mt-20 border-t bg-[#070707] text-white overflow-hidden">
      {/* Decorative gradient blur in the background */}
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[400px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 opacity-30 blur-[100px]" />
      
      <div className="container relative py-16">
        <div className="mb-16 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <span className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-primary via-primary/80 to-accent text-lg font-black shadow-lg shadow-primary/20">
              W
            </span>
            <div>
              <p className="text-2xl font-extrabold tracking-tight">Watchlist</p>
              <p className="mt-1 text-sm text-white/55">{t(locale, "common.brandTagline")}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
          {footerGroups.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.titleKey} className="flex flex-col gap-4">
                <h4 className="mb-5 flex items-center gap-2 font-bold text-white/90">
                  <Icon className="size-4 text-primary" /> {t(locale, group.titleKey)}
                </h4>
                <ul className="flex flex-col gap-3">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-sm font-medium text-white/55 transition-colors hover:text-primary">
                        {t(locale, link.labelKey)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-8 text-sm text-white/60 md:flex-row md:items-center md:justify-between">
          <LanguageSwitcher locale={locale} labels={localeLabels} />
          <p>{t(locale, "common.copyright")}</p>
        </div>
      </div>
    </footer>
  );
}
