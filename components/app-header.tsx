import Link from "next/link";
import { ChevronDown, Bell, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, signOut } from "@/lib/auth";
import { mainNav, userNav, footerGroups, productCards } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { PresenceClient } from "@/components/presence/presence-client";
import { CommandMenu } from "@/components/command-menu";
import { getCurrentLocale, t } from "@/lib/i18n";
import { MainNav } from "@/components/main-nav";
import { initials } from "@/lib/utils";

export async function AppHeader() {
  const user = await requireUser();
  const isAdmin = user?.role === "admin";
  const locale = user?.preferredLanguage ?? await getCurrentLocale();
  const visibleMainNav = mainNav
    .filter((item) => !item.authOnly || user)
    .map((item) => ({
      href: item.href,
      label: t(locale, item.labelKey) || item.label,
    }));

  let pendingRequestsCount = 0;
  let unreadMessagesCount = 0;
  if (user) {
    const [pendingRequests, unreadMessages] = await Promise.all([
      prisma.friend.count({
        where: {
          friendId: Number(user.id),
          status: "pending"
        }
      }),
      prisma.friendMessage.count({
        where: {
          receiverId: Number(user.id),
          readAt: null
        }
      })
    ]);
    pendingRequestsCount = pendingRequests;
    unreadMessagesCount = unreadMessages;
  }
  const totalNotifications = pendingRequestsCount + unreadMessagesCount;

  // Окремі групи для мега-меню
  const productsGroup = footerGroups.find(g => g.title === "Продукти");
  const scenariosGroup = footerGroups.find(g => g.title === "Сценарії");
  const companyGroup = footerGroups.find(g => g.title === "Компанія");
  const developersGroup = footerGroups.find(g => g.title === "Розробникам");

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container flex min-h-20 items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="group flex items-center gap-3 font-extrabold transition-transform hover:scale-105">
            <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-primary via-primary/80 to-accent text-white shadow-lg shadow-primary/20">
              W
            </span>
            <span className="text-xl tracking-tight">Watchlist</span>
          </Link>
          
          <nav className="hidden items-center gap-1 md:flex">
            {user ? (
              // APP VIEW (Для авторизованих: швидкі прямі посилання)
              <MainNav items={visibleMainNav} />
            ) : (
              // MARKETING VIEW (Для гостей: компактні випадаючі меню)
              <>
                {/* ПРОДУКТИ */}
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                    Продукти <ChevronDown className="size-3 opacity-50" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 p-1.5 shadow-xl">
                    {productCards.filter(p => !p.adminOnly || isAdmin).map((product) => {
                      const Icon = product.icon;
                      return (
                        <DropdownMenuItem asChild key={product.href}>
                          <Link href={product.href} className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors">
                            <Icon className="size-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{product.title}</span>
                          </Link>
                        </DropdownMenuItem>
                      )
                    })}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/watchlist-plus" className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-primary focus:bg-primary/10 focus:text-primary">
                        <Sparkles className="size-4" />
                        <span className="text-sm font-medium">Watchlist Plus</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* СЦЕНАРІЇ */}
                {scenariosGroup && (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                      {t(locale, scenariosGroup.titleKey)} <ChevronDown className="size-3 opacity-50" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56 p-1.5 shadow-xl">
                      {scenariosGroup.links.map((link) => (
                        <DropdownMenuItem asChild key={link.href}>
                          <Link href={link.href} className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 transition-colors">
                            <span className="text-sm font-medium">{t(locale, link.labelKey)}</span>
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* КОМПАНІЯ & РОЗРОБНИКАМ */}
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                    Ресурси <ChevronDown className="size-3 opacity-50" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 p-1.5 shadow-xl">
                    {companyGroup && (
                      <>
                        <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {t(locale, companyGroup.titleKey)}
                        </DropdownMenuLabel>
                        {companyGroup.links.map(link => (
                            <DropdownMenuItem asChild key={link.href}>
                              <Link href={link.href} className="flex cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-colors">
                                {t(locale, link.labelKey)}
                              </Link>
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}
                      <DropdownMenuSeparator />
                      {developersGroup && (
                        <>
                          <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {t(locale, developersGroup.titleKey)}
                          </DropdownMenuLabel>
                          {developersGroup.links.map(link => (
                            <DropdownMenuItem asChild key={link.href}>
                              <Link href={link.href} className="flex cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-colors">
                                {t(locale, link.labelKey)}
                              </Link>
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* <CommandMenu /> - Тимчасово вимкнено до майбутніх оновлень */}
          <ThemeToggle />
          {user ? (
            <>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger
                className="relative flex size-9 items-center justify-center rounded-full border bg-card text-muted-foreground transition hover:border-primary hover:text-foreground outline-none cursor-pointer"
                aria-label="Сповіщення"
              >
                <Bell className="size-4" />
                {totalNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {totalNotifications > 9 ? "9+" : totalNotifications}
                  </span>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-2">
                <DropdownMenuLabel className="font-bold text-xs uppercase tracking-wider text-muted-foreground px-2 py-1">
                  Сповіщення
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/friends" className="flex items-center justify-between cursor-pointer p-2">
                    <span className="text-sm font-medium">Запити в друзі</span>
                    {pendingRequestsCount > 0 ? (
                      <Badge variant="destructive" className="h-5 px-1.5 text-xs">{pendingRequestsCount}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">0</span>
                    )}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/messages" className="flex items-center justify-between cursor-pointer p-2">
                    <span className="text-sm font-medium">Непрочитані чати</span>
                    {unreadMessagesCount > 0 ? (
                      <Badge variant="destructive" className="h-5 px-1.5 text-xs">{unreadMessagesCount}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">0</span>
                    )}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <PresenceClient userId={user.id} />
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger className="flex cursor-pointer list-none items-center gap-2 rounded-full border bg-card py-1.5 pl-1.5 pr-4 text-sm font-bold shadow-sm outline-none transition hover:border-primary focus:border-primary [&::-webkit-details-marker]:hidden">
                <Avatar className="size-6">
                  {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
                  <AvatarFallback className="text-[10px]">{initials(user.name)}</AvatarFallback>
                </Avatar>
                <span className="max-w-[8rem] truncate sm:max-w-[12rem]">{user.name}</span>
                <ChevronDown className="size-4 text-muted-foreground transition" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-2">
                <div className="mb-2 px-2 py-1.5">
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  <div className="mt-1 flex gap-1">
                    <Badge variant={isAdmin ? "default" : "secondary"} className="text-[10px] uppercase">{t(locale, `role.${user.role}`)}</Badge>
                  </div>
                </div>
                <DropdownMenuSeparator />
                {userNav
                  .filter((item) => !item.adminOnly || isAdmin)
                  .map((item) => (
                    <DropdownMenuItem asChild key={item.href}>
                      <Link
                        href={item.href}
                        className="cursor-pointer px-2 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
                      >
                        {t(locale, item.labelKey)}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                <DropdownMenuSeparator />
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/" });
                  }}
                >
                  <button
                    className="relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-2 text-sm font-semibold outline-none transition-colors text-red-500 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                    type="submit"
                  >
                    {t(locale, "common.signOut")}
                  </button>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm" className="rounded-full">
                <Link href="/login">{t(locale, "common.signIn")}</Link>
              </Button>
              <Button asChild size="sm" className="hidden rounded-full sm:inline-flex shadow-lg shadow-primary/20">
                <Link href="/register">{t(locale, "common.signUp")}</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
