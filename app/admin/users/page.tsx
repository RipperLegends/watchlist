import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { deleteUser, toggleUserBlock, updateUserRole, updateWatchlistPlusAccess } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { getAdminUsers } from "@/lib/data";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export const dynamic = "force-dynamic";

type UsersSearchParams = {
  filter?: string;
};

type UsersPageProps = {
  searchParams?: Promise<UsersSearchParams>;
};

const userFilters = [
  { value: "all", label: "Усі" },
  { value: "user", label: "Користувачі" },
  { value: "admin", label: "Адміни" },
  { value: "blocked", label: "Заблоковані" }
] as const;

function normalizeUserFilter(value?: string): UserRole | "all" | "blocked" {
  return value === "user" || value === "admin" || value === "blocked" ? value : "all";
}

function usersUrl(filter: string) {
  return filter === "all" ? "/admin/users" : `/admin/users?filter=${filter}`;
}

function plusLabel(user: { role: UserRole; watchlistPlusLifetime: boolean; watchlistPlusUntil: Date | null }) {
  if (user.role === "admin") return "admin доступ";
  if (user.watchlistPlusLifetime) return "назавжди";
  if (user.watchlistPlusUntil && user.watchlistPlusUntil > new Date()) {
    return `до ${user.watchlistPlusUntil.toLocaleDateString("uk-UA")}`;
  }
  if (user.watchlistPlusUntil) return "завершився";
  return "немає";
}

export default async function AdminUsersPage({ searchParams }: UsersPageProps) {
  const params = searchParams ? await searchParams : {};
  const filter = normalizeUserFilter(params.filter);
  const [admin, users] = await Promise.all([requireAdmin(), getAdminUsers(filter)]);
  const returnTo = usersUrl(filter);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Badge className="w-fit" variant="secondary">CRM</Badge>
        <h1 className="section-title">Користувачі</h1>
        <p className="section-lead">Ролі, блокування, видалення і коротка статистика акаунтів.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {userFilters.map((item) => (
          <Button key={item.value} asChild variant={filter === item.value ? "default" : "secondary"} size="sm">
            <Link href={usersUrl(item.value)}>{item.label}</Link>
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Акаунти</CardTitle>
          <CardDescription>Показано {users.length} користувачів.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Логін</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Plus</TableHead>
                <TableHead>Дані</TableHead>
                <TableHead>Створено</TableHead>
                <TableHead>Дії</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-bold">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell><Badge>{user.role}</Badge></TableCell>
                  <TableCell><Badge variant={user.accountStatus === "blocked" ? "destructive" : "secondary"}>{user.accountStatus}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={user.watchlistPlusLifetime || (user.watchlistPlusUntil && user.watchlistPlusUntil > new Date()) || user.role === "admin" ? "default" : "outline"}>
                      {plusLabel(user)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user._count.entries} записів · {user._count.reports} звернень</TableCell>
                  <TableCell>{formatDate(user.createdAt)}</TableCell>
                  <TableCell>
                    {String(user.id) === admin?.id ? (
                      <Badge variant="outline">Поточний адмін</Badge>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8">
                            Дії <ChevronDown className="ml-2 size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <form action={updateUserRole}>
                            <input type="hidden" name="id" value={user.id} />
                            <input type="hidden" name="role" value={user.role === "admin" ? "user" : "admin"} />
                            <input type="hidden" name="returnTo" value={returnTo} />
                            <button className="relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground" type="submit">
                              {user.role === "admin" ? "Зняти права адміна" : "Надати права адміна"}
                            </button>
                          </form>

                          <form action={toggleUserBlock}>
                            <input type="hidden" name="id" value={user.id} />
                            <input type="hidden" name="accountStatus" value={user.accountStatus} />
                            <input type="hidden" name="returnTo" value={returnTo} />
                            <button className={`relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground ${user.accountStatus === "blocked" ? "" : "text-destructive"}`} type="submit">
                              {user.accountStatus === "blocked" ? "Розблокувати" : "Заблокувати акаунт"}
                            </button>
                          </form>

                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Watchlist Plus</DropdownMenuLabel>
                          
                          <form action={updateWatchlistPlusAccess}>
                            <input type="hidden" name="id" value={user.id} />
                            <input type="hidden" name="mode" value="month" />
                            <input type="hidden" name="returnTo" value={returnTo} />
                            <button className="relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground" type="submit">Надати на 1 місяць</button>
                          </form>
                          <form action={updateWatchlistPlusAccess}>
                            <input type="hidden" name="id" value={user.id} />
                            <input type="hidden" name="mode" value="lifetime" />
                            <input type="hidden" name="returnTo" value={returnTo} />
                            <button className="relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground" type="submit">Надати назавжди</button>
                          </form>
                          <form action={updateWatchlistPlusAccess}>
                            <input type="hidden" name="id" value={user.id} />
                            <input type="hidden" name="mode" value="revoke" />
                            <input type="hidden" name="returnTo" value={returnTo} />
                            <button className="relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground" type="submit">Зняти доступ</button>
                          </form>

                          <DropdownMenuSeparator />

                          <form action={deleteUser}>
                            <input type="hidden" name="id" value={user.id} />
                            <input type="hidden" name="returnTo" value={returnTo} />
                            <button className="relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors text-destructive hover:bg-destructive/10 hover:text-destructive" type="submit">
                              Видалити акаунт
                            </button>
                          </form>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!users.length ? <p className="p-6 text-sm text-muted-foreground">Користувачів за цим фільтром немає.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
