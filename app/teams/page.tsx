import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const teams = await prisma.team.findMany({
    where: { members: { some: { userId: Number(session.user.id) } } },
    include: { members: true, items: true }
  });

  return (
    <div className="page-shell flex flex-col gap-8">
      <header>
        <h1 className="section-title">Команди</h1>
        <p className="section-lead">Команди для спільного watchlist, ролей admin/member, голосування і розкладу перегляду.</p>
      </header>
      {teams.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map((team) => (
            <Card key={team.id}>
              <CardHeader>
                <CardTitle>{team.name}</CardTitle>
                <CardDescription>{team.description || "Командний каталог"}</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <p>Учасники: {team.members.length}</p>
                <p>Пункти: {team.items.length}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="Команд поки немає." description="Функція готова в моделі даних і UI, наступний крок — форма створення команди." />
      )}
    </div>
  );
}
