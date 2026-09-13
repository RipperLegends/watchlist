import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { EntryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getFriendsForUser } from "@/lib/data";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Plus, Trash2, CheckCircle2, PlayCircle, Clock, type LucideIcon } from "lucide-react";

export const dynamic = "force-dynamic";

// --- SERVER ACTIONS ---

async function createTeam(formData: FormData) {
  "use server";
  const user = await requireUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim().slice(0, 300);
  if (name.length < 2) return;

  await prisma.team.create({
    data: {
      name: name.slice(0, 80),
      description,
      ownerId: Number(user.id),
      members: {
        create: {
          userId: Number(user.id),
          role: "admin"
        }
      }
    }
  });
  await prisma.auditLog.create({ data: { userId: Number(user.id), action: "team.create", details: name } });
  revalidatePath("/teams");
}

async function addTeamItem(formData: FormData) {
  "use server";
  const user = await requireUser();
  if (!user) redirect("/login");

  const teamId = Number(formData.get("teamId"));
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type")) === "series" ? "series" : "movie";
  const status = String(formData.get("status")) === "watching" ? "watching" : String(formData.get("status")) === "completed" ? "completed" : "planned";
  if (!Number.isInteger(teamId) || teamId <= 0 || title.length < 1) return;

  const member = await prisma.teamMember.findFirst({ where: { teamId, userId: Number(user.id) } });
  if (!member) return;

  await prisma.teamItem.create({
    data: { teamId, title: title.slice(0, 120), type, status, createdById: Number(user.id) }
  });
  revalidatePath("/teams");
}

async function deleteTeamItem(formData: FormData) {
  "use server";
  const user = await requireUser();
  if (!user) redirect("/login");

  const itemId = Number(formData.get("itemId"));
  if (!Number.isInteger(itemId) || itemId <= 0) return;

  const item = await prisma.teamItem.findFirst({
    where: { id: itemId, team: { members: { some: { userId: Number(user.id), role: "admin" } } } }
  });
  if (!item) return;

  await prisma.teamItem.delete({ where: { id: itemId } });
  revalidatePath("/teams");
}

async function changeItemStatus(formData: FormData) {
  "use server";
  const user = await requireUser();
  if (!user) redirect("/login");

  const itemId = Number(formData.get("itemId"));
  const status = String(formData.get("status"));
  if (!Number.isInteger(itemId) || itemId <= 0) return;

  const item = await prisma.teamItem.findFirst({
    where: { id: itemId, team: { members: { some: { userId: Number(user.id) } } } }
  });
  if (!item || !["planned", "watching", "completed"].includes(status)) return;

  await prisma.teamItem.update({ where: { id: itemId }, data: { status: status as EntryStatus } });
  revalidatePath("/teams");
}

async function toggleItemVote(formData: FormData) {
  "use server";
  const user = await requireUser();
  if (!user) redirect("/login");

  const itemId = Number(formData.get("itemId"));
  if (!Number.isInteger(itemId) || itemId <= 0) return;

  const item = await prisma.teamItem.findFirst({
    where: { id: itemId, team: { members: { some: { userId: Number(user.id) } } } }
  });
  if (!item) return;

  const userId = Number(user.id);
  // Use a transaction to prevent race conditions on concurrent vote toggles
  await prisma.$transaction(async (tx) => {
    const existingVote = await tx.teamVote.findUnique({
      where: { itemId_userId: { itemId, userId } }
    });
    if (existingVote) {
      await tx.teamVote.delete({ where: { itemId_userId: { itemId, userId } } });
    } else {
      await tx.teamVote.create({ data: { itemId, userId, value: 1 } });
    }
  });
  revalidatePath("/teams");
}

async function addTeamMember(formData: FormData) {
  "use server";
  const user = await requireUser();
  if (!user) redirect("/login");

  const teamId = Number(formData.get("teamId"));
  const friendId = Number(formData.get("friendId"));
  if (!Number.isInteger(teamId) || teamId <= 0 || !Number.isInteger(friendId) || friendId <= 0) return;

  const isAdmin = await prisma.teamMember.findFirst({
    where: { teamId, userId: Number(user.id), role: "admin" }
  });
  if (!isAdmin) return;

  // Use upsert to prevent race-condition duplicate member inserts
  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId, userId: friendId } },
    update: {},
    create: { teamId, userId: friendId, role: "member" }
  });
  revalidatePath("/teams");
}

// --- UTILS ---
const statusMap: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  planned: { label: "В планах", icon: Clock, color: "bg-secondary text-secondary-foreground" },
  watching: { label: "Дивимось", icon: PlayCircle, color: "bg-primary text-primary-foreground" },
  completed: { label: "Завершено", icon: CheckCircle2, color: "bg-green-500/20 text-green-500" }
};
const typeMap: Record<string, string> = { movie: "Фільм", series: "Серіал" };

export default async function TeamsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  // Fetch teams & friends in parallel
  const [teams, friendsData] = await Promise.all([
    prisma.team.findMany({
      where: { members: { some: { userId: Number(user.id) } } },
      include: {
        members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } }, orderBy: { joinedAt: "asc" } },
        items: { include: { votes: true, createdBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } }
      },
      orderBy: { createdAt: "desc" }
    }),
    getFriendsForUser(user.id)
  ]);

  const activeFriends = friendsData.filter(f => f.status === "accepted" && !f.blocked && !f.blockedByOther);

  return (
    <div className="page-shell grid gap-6 xl:grid-cols-[360px_1fr]">
      <section className="flex flex-col gap-6">
        <header>
          <h1 className="section-title">Команди</h1>
          <p className="section-lead">Створюйте команду, запрошуйте друзів, ведіть спільний watchlist і голосуйте за те, що дивитись наступним.</p>
        </header>
        <Card>
          <CardHeader>
            <CardTitle>Нова команда</CardTitle>
            <CardDescription>Після створення ви автоматично стаєте admin команди.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createTeam} className="flex flex-col gap-3">
              <Input name="name" placeholder="Назва команди" minLength={2} maxLength={80} required />
              <Textarea name="description" placeholder="Короткий опис або мета команди" maxLength={300} />
              <Button type="submit">Створити команду</Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        {teams.length > 0 ? (
          <Tabs defaultValue={teams[0].id.toString()} className="w-full">
            <TabsList className="mb-4 flex w-full flex-wrap justify-start h-auto">
              {teams.map((team) => (
                <TabsTrigger key={team.id} value={team.id.toString()}>
                  {team.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {teams.map((team) => {
              const isTeamAdmin = team.members.some(m => m.userId === Number(user.id) && m.role === "admin");
              
              return (
                <TabsContent key={team.id} value={team.id.toString()} className="mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle>{team.name}</CardTitle>
                      <CardDescription>{team.description || "Командний watchlist."}</CardDescription>
                    </CardHeader>
                <CardContent className="grid gap-5 lg:grid-cols-[1fr_300px]">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <Badge variant="secondary">{team.members.length} учасників</Badge>
                      <Badge variant="secondary">{team.items.length} пунктів</Badge>
                      <Badge variant="secondary">{team.items.reduce((sum, item) => sum + item.votes.length, 0)} голосів</Badge>
                    </div>
                    {team.items.length ? (
                      team.items.map((item) => {
                        const hasVoted = item.votes.some(v => v.userId === Number(user.id));
                        const status = statusMap[item.status];
                        const StatusIcon = status?.icon;

                        return (
                          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/30">
                            <div className="flex flex-col gap-1">
                              <p className="text-lg font-bold">{item.title}</p>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline" className="font-normal">{typeMap[item.type]}</Badge>
                                {status && (
                                  <Badge className={status.color} variant="secondary">
                                    <StatusIcon className="mr-1.5 size-3" />
                                    {status.label}
                                  </Badge>
                                )}
                                <span>додав(ла) {item.createdBy.name}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <form action={toggleItemVote} className="flex items-center gap-2">
                                <input type="hidden" name="itemId" value={item.id} />
                                <span className="text-sm font-bold text-foreground">{item.votes.length}</span>
                                <Button size="sm" variant={hasVoted ? "default" : "secondary"} type="submit">
                                  {hasVoted ? "Відкликати" : "Голосувати"}
                                </Button>
                              </form>
                              
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground">
                                    <MoreVertical className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Змінити статус</DropdownMenuLabel>
                                  <form action={changeItemStatus}>
                                    <input type="hidden" name="itemId" value={item.id} />
                                    <input type="hidden" name="status" value="planned" />
                                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).closest("form")?.requestSubmit(); }} className="cursor-pointer">
                                      В планах
                                    </DropdownMenuItem>
                                  </form>
                                  <form action={changeItemStatus}>
                                    <input type="hidden" name="itemId" value={item.id} />
                                    <input type="hidden" name="status" value="watching" />
                                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).closest("form")?.requestSubmit(); }} className="cursor-pointer">
                                      Дивимось
                                    </DropdownMenuItem>
                                  </form>
                                  <form action={changeItemStatus}>
                                    <input type="hidden" name="itemId" value={item.id} />
                                    <input type="hidden" name="status" value="completed" />
                                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).closest("form")?.requestSubmit(); }} className="cursor-pointer">
                                      Завершено
                                    </DropdownMenuItem>
                                  </form>
                                  
                                  {isTeamAdmin && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <form action={deleteTeamItem}>
                                        <input type="hidden" name="itemId" value={item.id} />
                                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).closest("form")?.requestSubmit(); }} className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive">
                                          <Trash2 className="mr-2 size-4" /> Видалити
                                        </DropdownMenuItem>
                                      </form>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <EmptyState title="Поки що пусто" description="У спільному списку ще нічого немає. Додайте перший фільм!" />
                    )}
                  </div>

                  <div className="flex flex-col gap-4">
                    <form action={addTeamItem} className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4">
                      <input type="hidden" name="teamId" value={team.id} />
                      <p className="font-bold">Додати у список</p>
                      <Input name="title" placeholder="Назва фільму або серіалу" required className="bg-background" />
                      <Select name="type" defaultValue="movie">
                        <option value="movie">Фільм</option>
                        <option value="series">Серіал</option>
                      </Select>
                      <Select name="status" defaultValue="planned">
                        <option value="planned">В планах</option>
                        <option value="watching">Дивимось</option>
                        <option value="completed">Завершено</option>
                      </Select>
                      <Button type="submit">Додати</Button>
                    </form>

                    <div className="rounded-xl border bg-card p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="font-bold">Учасники</p>
                        {isTeamAdmin && activeFriends.length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-6 w-6"><Plus className="size-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel>Запросити друга</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {activeFriends.filter(f => !team.members.some(m => m.userId === f.friend.id)).length > 0 ? (
                                activeFriends
                                  .filter(f => !team.members.some(m => m.userId === f.friend.id))
                                  .map(f => (
                                    <form key={f.friend.id} action={addTeamMember}>
                                      <input type="hidden" name="teamId" value={team.id} />
                                      <input type="hidden" name="friendId" value={f.friend.id} />
                                      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).closest("form")?.requestSubmit(); }} className="flex cursor-pointer items-center gap-2 text-left">
                                        <Avatar className="size-5">
                                          {f.friend.avatarUrl ? <AvatarImage src={f.friend.avatarUrl} alt={f.friend.name || ""} /> : null}
                                          <AvatarFallback className="text-[9px]">{initials(f.friend.name)}</AvatarFallback>
                                        </Avatar>
                                        {f.friend.name}
                                      </DropdownMenuItem>
                                    </form>
                                  ))
                              ) : (
                                <div className="p-2 text-xs text-muted-foreground">Усі друзі вже тут!</div>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      
                      <div className="flex flex-col gap-3 text-sm">
                        {team.members.map((member) => (
                          <div key={member.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Avatar className="size-6">
                                {member.user.avatarUrl ? <AvatarImage src={member.user.avatarUrl} alt={member.user.name || ""} /> : null}
                                <AvatarFallback className="text-[10px]">{initials(member.user.name)}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{member.user.name}</span>
                            </div>
                            <Badge variant="outline" className="text-[10px] uppercase">{member.role}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>
        ) : (
          <EmptyState title="Команд поки немає." description="Створіть першу команду й додайте спільний список для друзів або кіберкоманди." />
        )}
      </section>
    </div>
  );
}
