import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { mainNav, userNav } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";

export async function AppHeader() {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  return (
    <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
      <div className="container flex min-h-20 items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 font-extrabold">
            <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white">
              W
            </span>
            <span className="text-xl">Watchlist</span>
          </Link>
          <nav className="hidden items-center gap-5 md:flex">
            {mainNav.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm font-semibold text-muted-foreground hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {session?.user ? (
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-md border px-3 py-2 md:flex">
                {isAdmin ? <ShieldCheck data-icon="inline-start" /> : null}
                <span className="text-sm font-bold">{session.user.name}</span>
                <Badge variant={isAdmin ? "default" : "secondary"}>{session.user.role}</Badge>
              </div>
              <nav className="hidden items-center gap-2 lg:flex">
                {userNav
                  .filter((item) => !item.adminOnly || isAdmin)
                  .map((item) => (
                    <Button key={item.href} asChild variant="ghost" size="sm">
                      <Link href={item.href}>{item.label}</Link>
                    </Button>
                  ))}
              </nav>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <Button variant="secondary" size="sm" type="submit">
                  Вийти
                </Button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost">
                <Link href="/login">Увійти</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Реєстрація</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
