import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export const dynamic = "force-dynamic";

async function updatePrivacy(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user) redirect("/login");

  await prisma.user.update({
    where: { id: Number(session.user.id) },
    data: {
      presenceStatus: String(formData.get("presenceStatus") ?? "online") as "online" | "offline" | "dnd" | "hidden",
      onlineVisibility: String(formData.get("onlineVisibility") ?? "everyone") as "everyone" | "friends" | "nobody",
      profileVisibility: String(formData.get("profileVisibility") ?? "everyone") as "everyone" | "friends" | "nobody",
      friendRequestPolicy: String(formData.get("friendRequestPolicy") ?? "everyone") as "everyone" | "friends" | "nobody",
      preferredLanguage: String(formData.get("preferredLanguage") ?? "UK") as "UK" | "RU" | "EN"
    }
  });
}

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: Number(session.user.id) } });

  return (
    <div className="page-shell grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>Налаштування акаунта</CardTitle>
          <CardDescription>Логін, email і базові параметри доступу.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Input value={user.name} readOnly />
          <Input value={user.email} readOnly />
          <Input placeholder="Новий пароль" type="password" disabled />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Приватність</CardTitle>
          <CardDescription>Дефолт: онлайн, усі бачать статус, профіль і можуть надсилати заявки.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updatePrivacy} className="flex flex-col gap-4">
            <Select name="presenceStatus" defaultValue={user.presenceStatus}>
              <option value="online">Онлайн</option>
              <option value="offline">Офлайн</option>
              <option value="dnd">Не турбувати</option>
            </Select>
            <Select name="onlineVisibility" defaultValue={user.onlineVisibility}>
              <option value="everyone">Хто бачить онлайн: Усі</option>
              <option value="friends">Друзі</option>
              <option value="nobody">Ніхто</option>
            </Select>
            <Select name="profileVisibility" defaultValue={user.profileVisibility}>
              <option value="everyone">Видимість профілю: Усі</option>
              <option value="friends">Друзі</option>
              <option value="nobody">Ніхто</option>
            </Select>
            <Select name="friendRequestPolicy" defaultValue={user.friendRequestPolicy}>
              <option value="everyone">Хто може надсилати заявки: Усі</option>
              <option value="friends">Друзі друзів</option>
              <option value="nobody">Ніхто</option>
            </Select>
            <Select name="preferredLanguage" defaultValue={user.preferredLanguage}>
              <option value="UK">Українська</option>
              <option value="RU">Русский</option>
              <option value="EN">English</option>
            </Select>
            <Button type="submit">Зберегти приватність</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
