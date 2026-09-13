"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ReportStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteSupabaseAuthUserById, updateSupabaseAuthUserById } from "@/lib/supabase-auth";

function safeAdminReturnTo(value: FormDataEntryValue | null, fallback: string) {
  const rawValue = String(value ?? "").trim();
  return (rawValue.startsWith("/admin/") || rawValue === "/admin") ? rawValue : fallback;
}

function normalizeReportStatus(value: FormDataEntryValue | null): ReportStatus | null {
  const status = String(value ?? "");
  return status === "new" || status === "reviewing" || status === "answered" || status === "closed" ? status : null;
}

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/catalog");
  revalidatePath("/admin/users");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/moderation");
  revalidatePath("/admin/audit");
  revalidatePath("/admin/maintenance");
}

export async function updateUserRole(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) redirect("/login");

  const id = Number(formData.get("id"));
  if (!id || id === Number(admin.id)) return;

  const role = String(formData.get("role")) === "admin" ? "admin" : "user";
  await prisma.user.update({ where: { id }, data: { role } });
  await prisma.auditLog.create({
    data: { userId: Number(admin.id), action: "user.role.update", details: `user:${id} role:${role}` }
  });
  revalidateAdmin();
  redirect(safeAdminReturnTo(formData.get("returnTo"), "/admin/users"));
}

export async function toggleUserBlock(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) redirect("/login");

  const id = Number(formData.get("id"));
  if (!id || id === Number(admin.id)) return;

  const accountStatus = String(formData.get("accountStatus")) === "blocked" ? "active" : "blocked";
  const targetUser = await prisma.user.findUnique({
    where: { id },
    select: { authUserId: true }
  });

  if (targetUser?.authUserId) {
    await updateSupabaseAuthUserById(targetUser.authUserId, {
      banDuration: accountStatus === "blocked" ? "876600h" : "none"
    });
  }

  await prisma.user.update({ where: { id }, data: { accountStatus } });
  await prisma.auditLog.create({
    data: { userId: Number(admin.id), action: "user.block.toggle", details: `user:${id} status:${accountStatus}` }
  });
  revalidateAdmin();
  redirect(safeAdminReturnTo(formData.get("returnTo"), "/admin/users"));
}

export async function deleteUser(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) redirect("/login");

  const id = Number(formData.get("id"));
  if (!id || id === Number(admin.id)) return;

  const targetUser = await prisma.user.findUnique({
    where: { id },
    select: { authUserId: true }
  });
  await deleteSupabaseAuthUserById(targetUser?.authUserId);
  await prisma.user.delete({ where: { id } });
  await prisma.auditLog.create({ data: { userId: Number(admin.id), action: "user.delete", details: `user:${id}` } });
  revalidateAdmin();
  redirect(safeAdminReturnTo(formData.get("returnTo"), "/admin/users"));
}

export async function updateWatchlistPlusAccess(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) redirect("/login");

  const id = Number(formData.get("id"));
  if (!id) return;

  const mode = String(formData.get("mode") ?? "");
  const targetUser = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      watchlistPlusUntil: true
    }
  });
  if (!targetUser) return;

  const now = new Date();
  let details = "";

  if (mode === "lifetime") {
    await prisma.user.update({
      where: { id },
      data: {
        watchlistPlusLifetime: true,
        watchlistPlusUntil: null,
        watchlistPlusGrantedAt: now,
        watchlistPlusGrantedBy: Number(admin.id)
      }
    });
    details = "lifetime";
  } else if (mode === "month") {
    const baseDate = targetUser.watchlistPlusUntil && targetUser.watchlistPlusUntil > now ? targetUser.watchlistPlusUntil : now;
    const expiresAt = new Date(baseDate);
    expiresAt.setDate(expiresAt.getDate() + 30);

    await prisma.user.update({
      where: { id },
      data: {
        watchlistPlusLifetime: false,
        watchlistPlusUntil: expiresAt,
        watchlistPlusGrantedAt: now,
        watchlistPlusGrantedBy: Number(admin.id)
      }
    });
    details = `until:${expiresAt.toISOString()}`;
  } else if (mode === "revoke") {
    await prisma.user.update({
      where: { id },
      data: {
        watchlistPlusLifetime: false,
        watchlistPlusUntil: null,
        watchlistPlusGrantedAt: null,
        watchlistPlusGrantedBy: null
      }
    });
    details = "revoked";
  } else {
    return;
  }

  await prisma.auditLog.create({
    data: { userId: Number(admin.id), action: "watchlist_plus.update", details: `user:${id} ${details}` }
  });
  revalidateAdmin();
  revalidatePath("/watchlist-plus");
  revalidatePath("/catalog");
  redirect(safeAdminReturnTo(formData.get("returnTo"), "/admin/users"));
}

export async function deleteEntry(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) redirect("/login");

  const id = Number(formData.get("id"));
  if (!id) return;

  await prisma.entry.delete({ where: { id } });
  await prisma.auditLog.create({ data: { userId: Number(admin.id), action: "entry.delete", details: `entry:${id}` } });
  revalidateAdmin();
  revalidatePath("/catalog");
  redirect(safeAdminReturnTo(formData.get("returnTo"), "/admin/catalog"));
}

export async function updateReportStatus(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) redirect("/login");

  const id = Number(formData.get("id"));
  const status = normalizeReportStatus(formData.get("status"));
  if (!id || !status) return;

  await prisma.report.update({ where: { id }, data: { status } });
  await prisma.auditLog.create({
    data: { userId: Number(admin.id), action: "report.status.update", details: `report:${id} status:${status}` }
  });
  revalidateAdmin();
  redirect(safeAdminReturnTo(formData.get("returnTo"), "/admin/reports"));
}

export async function deleteReport(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) redirect("/login");

  const id = Number(formData.get("id"));
  if (!id) return;

  await prisma.report.delete({ where: { id } });
  await prisma.auditLog.create({ data: { userId: Number(admin.id), action: "report.delete", details: `report:${id}` } });
  revalidateAdmin();
  redirect(safeAdminReturnTo(formData.get("returnTo"), "/admin/reports"));
}

export async function replyToReport(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) redirect("/login");

  const id = Number(formData.get("id"));
  const body = String(formData.get("body") ?? "").trim();
  if (!id || !body) return;

  await prisma.reportMessage.create({
    data: {
      reportId: id,
      senderId: Number(admin.id),
      senderRole: "admin",
      body
    }
  });
  await prisma.report.update({
    where: { id },
    data: {
      status: "answered",
      adminResponse: body,
      respondedAt: new Date(),
      respondedBy: Number(admin.id)
    }
  });
  await prisma.auditLog.create({ data: { userId: Number(admin.id), action: "report.reply", details: `report:${id}` } });
  revalidateAdmin();
  redirect(safeAdminReturnTo(formData.get("returnTo"), "/admin/reports"));
}

export async function cleanupOrphans(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) redirect("/login");

  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "CLEAN") return;

  const results = await prisma.$transaction([
    prisma.$executeRaw`delete from user_watchlist_items wi where not exists (select 1 from users u where u.id = wi.user_id) or not exists (select 1 from entries e where e.id = wi.entry_id)`,
    prisma.$executeRaw`delete from friend_messages m where not exists (select 1 from friends f where f.id = m.relation_id) or not exists (select 1 from users u where u.id = m.sender_id) or not exists (select 1 from users u where u.id = m.receiver_id)`,
    prisma.$executeRaw`delete from team_votes tv where not exists (select 1 from team_items ti where ti.id = tv.item_id) or not exists (select 1 from users u where u.id = tv.user_id)`,
    prisma.$executeRaw`delete from team_items ti where not exists (select 1 from teams t where t.id = ti.team_id) or not exists (select 1 from users u where u.id = ti.created_by)`,
    prisma.$executeRaw`delete from team_members tm where not exists (select 1 from teams t where t.id = tm.team_id) or not exists (select 1 from users u where u.id = tm.user_id)`,
    prisma.$executeRaw`delete from teams t where not exists (select 1 from users u where u.id = t.owner_id)`,
    prisma.$executeRaw`delete from friends f where not exists (select 1 from users u where u.id = f.user_id) or not exists (select 1 from users u where u.id = f.friend_id) or not exists (select 1 from users u where u.id = f.requested_by)`,
    prisma.$executeRaw`delete from entries e where not exists (select 1 from users u where u.id = e.user_id)`,
    prisma.$executeRaw`delete from report_messages rm where not exists (select 1 from reports r where r.id = rm.report_id)`,
    prisma.$executeRaw`update report_messages rm set sender_id = null where rm.sender_id is not null and not exists (select 1 from users u where u.id = rm.sender_id)`,
    prisma.$executeRaw`update reports r set user_id = null where r.user_id is not null and not exists (select 1 from users u where u.id = r.user_id)`,
    prisma.$executeRaw`update audit_logs a set user_id = null where a.user_id is not null and not exists (select 1 from users u where u.id = a.user_id)`
  ]);

  await prisma.auditLog.create({
    data: {
      userId: Number(admin.id),
      action: "maintenance.cleanup",
      details: `affected:${results.reduce((sum, value) => sum + Number(value), 0)}`
    }
  });
  revalidateAdmin();
  redirect("/admin/maintenance");
}
