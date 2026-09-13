import { AlertTriangle, CheckCircle2, Database } from "lucide-react";
import { cleanupOrphans } from "@/app/admin/actions";
import { getMaintenanceStatus } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const maintenanceLabels: Record<string, string> = {
  entries_without_user: "Записи без користувача",
  friends_without_user: "Дружби без користувача",
  messages_without_relation: "Повідомлення без зв’язку",
  reports_without_user: "Звернення без користувача",
  report_messages_without_parent: "Повідомлення звернень без батьківського запису",
  teams_without_owner: "Команди без власника",
  team_members_without_parent: "Учасники команд без команди або користувача",
  team_items_without_parent: "Командні записи без команди або автора",
  team_votes_without_parent: "Голоси без запису або користувача"
};

export default async function AdminMaintenancePage() {
  const maintenance = await getMaintenanceStatus();
  const hasProblems = maintenance.total > 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Badge className="w-fit" variant="secondary">Database care</Badge>
        <h1 className="section-title">Maintenance</h1>
        <p className="section-lead">Технічне прибирання бази: сироти, некоректні зв’язки й контроль перед очищенням.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <Database className="mb-3 size-8 text-primary" />
            <CardTitle className="text-3xl text-primary">{maintenance.total}</CardTitle>
            <CardDescription>проблемних зв’язків</CardDescription>
          </CardHeader>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{hasProblems ? "Потрібна увага" : "База виглядає чисто"}</CardTitle>
            <CardDescription>
              {hasProblems
                ? "Перевірте типи проблем нижче й запускайте очищення тільки якщо впевнені, що ці записи не потрібні."
                : "Сирітських записів у ключових таблицях не знайдено."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center gap-3">
            {hasProblems ? <AlertTriangle className="size-5 text-destructive" /> : <CheckCircle2 className="size-5 text-primary" />}
            <div>
              <CardTitle>Стан зв’язків</CardTitle>
              <CardDescription>Кількість записів, які посилаються на вже видалені сутності.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Перевірка</TableHead>
                <TableHead>Кількість</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {maintenance.items.map((item) => (
                <TableRow key={item.key}>
                  <TableCell>{maintenanceLabels[item.key] ?? item.key}</TableCell>
                  <TableCell>
                    <Badge variant={item.count ? "destructive" : "secondary"}>{item.count}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className={hasProblems ? "border-destructive/35" : ""}>
        <CardHeader>
          <CardTitle>Очищення сиріт БД</CardTitle>
          <CardDescription>
            Дія видаляє тільки записи, які втратили батьківський зв’язок. Для запуску введіть CLEAN.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={cleanupOrphans} className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Input name="confirm" placeholder="CLEAN" disabled={!hasProblems} />
            <Button type="submit" variant={hasProblems ? "destructive" : "secondary"} disabled={!hasProblems}>
              Очистити сироти БД
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
