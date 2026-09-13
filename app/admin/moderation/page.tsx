import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { toggleUserBlock } from "@/app/admin/actions";
import { getAdminUsers } from "@/lib/data";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AdminModerationPage() {
  const blockedUsers = await getAdminUsers("blocked");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Badge className="w-fit" variant="secondary">Moderation</Badge>
        <h1 className="section-title">Модерація</h1>
        <p className="section-lead">Окреме місце для акаунтів, які зараз обмежені на сайті.</p>
      </header>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Заблоковані акаунти</CardTitle>
              <CardDescription>Усього заблоковано: {blockedUsers.length}.</CardDescription>
            </div>
            <Button asChild variant="secondary">
              <Link href="/admin/users">Всі користувачі</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Користувач</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Дані</TableHead>
                <TableHead>Створено</TableHead>
                <TableHead>Дія</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blockedUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-bold">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell><Badge>{user.role}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user._count.entries} записів · {user._count.reports} звернень</TableCell>
                  <TableCell>{formatDate(user.createdAt)}</TableCell>
                  <TableCell>
                    <form action={toggleUserBlock}>
                      <input type="hidden" name="id" value={user.id} />
                      <input type="hidden" name="accountStatus" value={user.accountStatus} />
                      <input type="hidden" name="returnTo" value="/admin/moderation" />
                      <Button size="sm" type="submit" variant="secondary">
                        <ShieldCheck className="size-4" />
                        Розблокувати
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!blockedUsers.length ? (
            <p className="p-6 text-sm text-muted-foreground">Заблокованих користувачів немає.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
