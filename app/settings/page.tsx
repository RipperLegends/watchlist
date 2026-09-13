import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Language } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileMediaUpload } from "@/components/profile/profile-media-upload";
import { AccountMfaPanel } from "@/components/settings/admin-mfa-panel";
import { getSupabaseStorageStatus } from "@/lib/supabase-storage";
import { updateSupabaseAuthUserById } from "@/lib/supabase-auth";
import { normalizeStringList } from "@/lib/utils";
import { normalizeLocale, t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type PresenceValue = "online" | "offline" | "dnd" | "hidden";
type VisibilityValue = "everyone" | "friends" | "nobody";

const presenceValues = new Set<PresenceValue>(["online", "offline", "dnd", "hidden"]);
const visibilityValues = new Set<VisibilityValue>(["everyone", "friends", "nobody"]);

function normalizePresence(value: FormDataEntryValue | null): PresenceValue {
  return presenceValues.has(value as PresenceValue) ? value as PresenceValue : "online";
}

function normalizeVisibility(value: FormDataEntryValue | null): VisibilityValue {
  return visibilityValues.has(value as VisibilityValue) ? value as VisibilityValue : "everyone";
}

async function updateAccount(formData: FormData) {
  "use server";
  const sessionUser = await requireUser();
  if (!sessionUser) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (name.length < 2 || email.length < 5 || !email.includes("@")) return;

  const duplicate = await prisma.user.findFirst({
    where: {
      id: { not: Number(sessionUser.id) },
      OR: [
        { name: { equals: name, mode: "insensitive" } },
        { email: { equals: email, mode: "insensitive" } }
      ]
    },
    select: { id: true }
  });
  if (duplicate) return;

  const data: {
    name: string;
    email: string;
    preferredLanguage?: Language;
    passwordHash?: string;
  } = { name, email };

  const preferredLanguage = String(formData.get("preferredLanguage") ?? "");
  if (["UK", "RU", "EN"].includes(preferredLanguage)) {
    data.preferredLanguage = preferredLanguage as Language;
  }

  if (password.trim()) {
    if (password.length < 6) return;
    data.passwordHash = await bcrypt.hash(password, 10);
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: Number(sessionUser.id) },
    select: { authUserId: true }
  });
  if (currentUser?.authUserId) {
    const authUpdate = await updateSupabaseAuthUserById(currentUser.authUserId, {
      email,
      name,
      ...(password.trim() ? { password } : {})
    });
    if (!authUpdate.ok && authUpdate.reason !== "missing_config") return;
  }

  await prisma.user.update({
    where: { id: Number(sessionUser.id) },
    data
  });
  await prisma.auditLog.create({
    data: { userId: Number(sessionUser.id), action: "settings.account.update", details: password.trim() ? "with-password" : "profile-only" }
  });
  revalidatePath("/settings");
  revalidatePath("/", "layout");
}

async function updateProfileDetails(formData: FormData) {
  "use server";
  const sessionUser = await requireUser();
  if (!sessionUser) redirect("/login");

  await prisma.user.update({
    where: { id: Number(sessionUser.id) },
    data: {
      bio: String(formData.get("bio") ?? "").trim().slice(0, 500),
      favoriteGenres: normalizeStringList(String(formData.get("favoriteGenres") ?? ""), 8)
    }
  });
  revalidatePath("/settings");
  revalidatePath("/profile");
}

async function updatePrivacy(formData: FormData) {
  "use server";
  const sessionUser = await requireUser();
  if (!sessionUser) redirect("/login");

  await prisma.user.update({
    where: { id: Number(sessionUser.id) },
    data: {
      presenceStatus: normalizePresence(formData.get("presenceStatus")),
      onlineVisibility: normalizeVisibility(formData.get("onlineVisibility")),
      profileVisibility: normalizeVisibility(formData.get("profileVisibility")),
      friendRequestPolicy: normalizeVisibility(formData.get("friendRequestPolicy"))
    }
  });
  revalidatePath("/settings");
  revalidatePath("/", "layout");
}

async function unblockUser(formData: FormData) {
  "use server";
  const sessionUser = await requireUser();
  if (!sessionUser) redirect("/login");

  const id = Number(formData.get("id"));
  if (!id) return;

  const relation = await prisma.friend.findFirst({
    where: {
      id,
      OR: [
        { userId: Number(sessionUser.id) },
        { friendId: Number(sessionUser.id) }
      ]
    }
  });
  if (!relation) return;

  const currentIsOwner = relation.userId === Number(sessionUser.id);
  const blockedByUser = currentIsOwner ? false : relation.blockedByUser;
  const blockedByFriend = currentIsOwner ? relation.blockedByFriend : false;

  await prisma.friend.update({
    where: { id },
    data: {
      blockedByUser,
      blockedByFriend,
      status: blockedByUser || blockedByFriend ? "blocked" : "accepted"
    }
  });
  await prisma.auditLog.create({ data: { userId: Number(sessionUser.id), action: "friend.unblock", details: `relation:${id}` } });
  revalidatePath("/settings");
  revalidatePath("/friends");
}

export default async function SettingsPage() {
  const sessionUser = await requireUser();
  if (!sessionUser) redirect("/login");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: Number(sessionUser.id) } });
  const blockedRelations = await prisma.friend.findMany({
    where: {
      OR: [
        { userId: Number(sessionUser.id), blockedByUser: true },
        { friendId: Number(sessionUser.id), blockedByFriend: true }
      ]
    },
    include: {
      user: { select: { name: true, email: true, presenceStatus: true } },
      friend: { select: { name: true, email: true, presenceStatus: true } }
    },
    orderBy: { updatedAt: "desc" }
  });
  const blockedUsers = blockedRelations.map((relation) => {
    const currentIsOwner = relation.userId === Number(sessionUser.id);
    return {
      id: relation.id,
      person: currentIsOwner ? relation.friend : relation.user
    };
  });
  const storageStatus = getSupabaseStorageStatus();
  const favoriteGenres = Array.isArray(user.favoriteGenres) ? user.favoriteGenres.filter((item): item is string => typeof item === "string") : [];
  const locale = normalizeLocale(user.preferredLanguage);

  return (
    <div className="page-shell flex flex-col gap-8">
      <section className="max-w-3xl">
        <Badge variant="secondary" className="mb-4">{t(locale, "settings.eyebrow")}</Badge>
        <h1 className="section-title">{t(locale, "settings.title")}</h1>
        <p className="section-lead">{t(locale, "settings.description")}</p>
      </section>

      <Tabs defaultValue="account" className="flex flex-col gap-6 md:flex-row md:items-start">
        <TabsList className="flex h-auto w-full flex-row flex-wrap justify-start gap-2 bg-transparent p-0 md:w-64 md:flex-col">
          <TabsTrigger value="account" className="w-full justify-start data-[state=active]:bg-muted data-[state=active]:shadow-none">
            {t(locale, "settings.account.title")}
          </TabsTrigger>
          <TabsTrigger value="profile" className="w-full justify-start data-[state=active]:bg-muted data-[state=active]:shadow-none">
            {t(locale, "settings.profile.title")}
          </TabsTrigger>
          <TabsTrigger value="privacy" className="w-full justify-start data-[state=active]:bg-muted data-[state=active]:shadow-none">
            {t(locale, "settings.privacy.title")}
          </TabsTrigger>
          <TabsTrigger value="security" className="w-full justify-start data-[state=active]:bg-muted data-[state=active]:shadow-none">
            Безпека акаунта
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 w-full">
          <TabsContent value="account" className="mt-0 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t(locale, "settings.account.title")}</CardTitle>
                <CardDescription>{t(locale, "settings.account.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={updateAccount} className="flex flex-col gap-4">
                  <label className="flex flex-col gap-2 text-sm font-semibold">
                    {t(locale, "settings.account.name")}
                    <Input name="name" defaultValue={user.name} minLength={2} maxLength={40} required />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-semibold">
                    {t(locale, "settings.account.email")}
                    <Input name="email" defaultValue={user.email} type="email" required />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-semibold">
                    {t(locale, "settings.account.password")}
                    <Input name="password" placeholder={t(locale, "settings.account.passwordPlaceholder")} type="password" minLength={6} />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-semibold">
                    Мова інтерфейсу (Language)
                    <Select name="preferredLanguage" defaultValue={user.preferredLanguage}>
                      <option value="UK">Українська (UK)</option>
                      <option value="EN">English (EN)</option>
                      <option value="RU">Русский (RU)</option>
                    </Select>
                  </label>
                  <Button type="submit">{t(locale, "settings.account.save")}</Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="mt-0 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t(locale, "settings.profile.title")}</CardTitle>
                <CardDescription>{t(locale, "settings.profile.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={updateProfileDetails} className="flex flex-col gap-4">
                  <label className="flex flex-col gap-2 text-sm font-semibold">
                    {t(locale, "settings.profile.bio")}
                    <Textarea name="bio" defaultValue={user.bio} maxLength={500} placeholder={t(locale, "settings.profile.bioPlaceholder")} />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-semibold">
                    {t(locale, "settings.profile.genres")}
                    <Input name="favoriteGenres" defaultValue={favoriteGenres.join(", ")} placeholder={t(locale, "settings.profile.genresPlaceholder")} />
                  </label>
                  <Button type="submit">{t(locale, "settings.profile.save")}</Button>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t(locale, "settings.images.title")}</CardTitle>
                <CardDescription>{t(locale, "settings.images.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <ProfileMediaUpload
                  avatarUrl={user.avatarUrl}
                  coverUrl={user.coverUrl}
                  storageReady={storageStatus.configured}
                  labels={{
                    storageMissing: t(locale, "settings.images.storageMissing"),
                    pickFirst: t(locale, "settings.images.pickFirst"),
                    uploadFailed: t(locale, "settings.images.uploadFailed"),
                    avatarUpdated: t(locale, "settings.images.avatarUpdated"),
                    coverUpdated: t(locale, "settings.images.coverUpdated"),
                    avatar: t(locale, "settings.images.avatar"),
                    cover: t(locale, "settings.images.cover")
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy" className="mt-0 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t(locale, "settings.privacy.title")}</CardTitle>
                <CardDescription>{t(locale, "settings.privacy.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={updatePrivacy} className="flex flex-col gap-4">
                  <label className="flex flex-col gap-2 text-sm font-semibold">
                    {t(locale, "settings.privacy.status")}
                    <Select name="presenceStatus" defaultValue={user.presenceStatus}>
                      <option value="online">{t(locale, "settings.option.online")}</option>
                      <option value="offline">{t(locale, "settings.option.offline")}</option>
                      <option value="dnd">{t(locale, "settings.option.dnd")}</option>
                      <option value="hidden">{t(locale, "settings.option.hidden")}</option>
                    </Select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-semibold">
                    {t(locale, "settings.privacy.onlineVisibility")}
                    <Select name="onlineVisibility" defaultValue={user.onlineVisibility}>
                      <option value="everyone">{t(locale, "settings.option.everyone")}</option>
                      <option value="friends">{t(locale, "settings.option.friends")}</option>
                      <option value="nobody">{t(locale, "settings.option.nobody")}</option>
                    </Select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-semibold">
                    {t(locale, "settings.privacy.profileVisibility")}
                    <Select name="profileVisibility" defaultValue={user.profileVisibility}>
                      <option value="everyone">{t(locale, "settings.option.everyone")}</option>
                      <option value="friends">{t(locale, "settings.option.friends")}</option>
                      <option value="nobody">{t(locale, "settings.option.nobody")}</option>
                    </Select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-semibold">
                    {t(locale, "settings.privacy.friendRequests")}
                    <Select name="friendRequestPolicy" defaultValue={user.friendRequestPolicy}>
                      <option value="everyone">{t(locale, "settings.option.everyone")}</option>
                      <option value="friends">{t(locale, "settings.option.friendsOfFriends")}</option>
                      <option value="nobody">{t(locale, "settings.option.nobody")}</option>
                    </Select>
                  </label>
                  <Button type="submit">{t(locale, "settings.privacy.save")}</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t(locale, "settings.blocked.title")}</CardTitle>
                <CardDescription>{t(locale, "settings.blocked.description")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {blockedUsers.length ? (
                  blockedUsers.map((blockedUser) => (
                    <div key={blockedUser.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                      <div>
                        <p className="font-bold">{blockedUser.person.name}</p>
                        <p className="text-sm text-muted-foreground">{blockedUser.person.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{blockedUser.person.presenceStatus}</Badge>
                        <form action={unblockUser}>
                          <input type="hidden" name="id" value={blockedUser.id} />
                          <Button size="sm" variant="outline" type="submit">{t(locale, "settings.blocked.unblock")}</Button>
                        </form>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{t(locale, "settings.blocked.empty")}</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="mt-0 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Безпека акаунта</CardTitle>
                <CardDescription>Увімкніть 2FA для входу через застосунок Authenticator.</CardDescription>
              </CardHeader>
              <CardContent>
                <AccountMfaPanel />
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
