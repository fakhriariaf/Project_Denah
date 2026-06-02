import { requirePermission, getSessionRole } from "@/server/permissions";
import { db } from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { roles } from "@/db/schema/access";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateUserForm } from "./create-user-form";
import { RoleSelect } from "./role-select";
import { DeleteConfirm } from "@/components/delete-confirm";
import { deleteUser } from "@/server/actions/users";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { UserCog } from "lucide-react";
import { formatDate } from "@/lib/format-utils";
import { Translate } from "@/components/translate";
import { getI18n } from "@/lib/i18n-server";
import { ResetPasswordDialog } from "./reset-password-dialog";

export default async function UsersPage() {
  const activeUser = await requirePermission("user.read");
  const { isSuperAdmin } = await getSessionRole(activeUser.id);
  const { t } = await getI18n();

  const [usersList, rolesList] = await Promise.all([
    db.select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      roleId: userTable.roleId,
      roleName: roles.name,
      createdAt: userTable.createdAt,
    })
    .from(userTable)
    .leftJoin(roles, eq(userTable.roleId, roles.id))
    .orderBy(userTable.createdAt),

    db.select({ id: roles.id, name: roles.name }).from(roles).orderBy(roles.name),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {/* ── PREMIUM HEADER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-[#D6DED2] shadow-sage p-6">
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 h-20 w-20 rounded-full bg-[#4F6F52]/8 blur-xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[#4F6F52] flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
              <UserCog className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#243028] tracking-tight"><Translate namespace="users" translationKey="title" /></h2>
              <p className="text-sm text-[#66736A] mt-0.5"><Translate namespace="users" translationKey="desc" /></p>
            </div>
          </div>
          <div className="shrink-0 animate-in fade-in zoom-in-95 duration-200 self-end md:self-center">
            <CreateUserForm roles={rolesList} />
          </div>
        </div>
      </div>

      <Card className="border-[#D6DED2] bg-white/70 backdrop-blur-md shadow-sage rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-[#D6DED2]/50">
          <CardTitle className="text-lg font-bold text-[#243028]"><Translate namespace="users" translationKey="list_title" /></CardTitle>
          <CardDescription className="text-xs text-[#66736A]">{t("users.total", { count: usersList.length })}</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="rounded-xl border border-[#D6DED2] overflow-hidden bg-white/50">
            <Table>
              <TableHeader className="bg-muted/40 border-b border-[#D6DED2]">
                <TableRow className="hover:bg-transparent border-[#D6DED2]">
                  <TableHead className="text-xs font-semibold text-[#4F6F52] h-10"><Translate namespace="users" translationKey="col_name" /></TableHead>
                  <TableHead className="text-xs font-semibold text-[#4F6F52] h-10"><Translate namespace="users" translationKey="col_email" /></TableHead>
                  <TableHead className="text-xs font-semibold text-[#4F6F52] h-10"><Translate namespace="users" translationKey="col_role" /></TableHead>
                  <TableHead className="text-xs font-semibold text-[#4F6F52] h-10"><Translate namespace="users" translationKey="col_registered" /></TableHead>
                  <TableHead className="text-xs font-semibold text-[#4F6F52] h-10 text-right"><Translate namespace="users" translationKey="col_action" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs font-sans">
                      <Translate namespace="users" translationKey="empty" />
                    </TableCell>
                  </TableRow>
                ) : (
                  usersList.map((u) => (
                    <TableRow key={u.id} className="hover:bg-[#F7F8F3]/60 border-b border-[#D6DED2] transition-colors duration-200">
                      <TableCell className="font-medium text-[#243028] py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-xl bg-[#DDE8D8] text-[#4F6F52] flex items-center justify-center font-bold text-xs shrink-0 select-none shadow-[inset_0_2px_4px_rgba(79,111,82,0.06)] border border-[#8FAF9A]/20">
                            {u.name.substring(0, 1).toUpperCase()}
                          </div>
                          <span className="font-semibold text-xs tracking-tight">{u.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-[#66736A] tracking-tight">{u.email}</TableCell>
                      <TableCell>
                        <RoleSelect
                          userId={u.id}
                          currentRoleId={u.roleId}
                          roles={rolesList}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[#66736A] tabular-nums">
                        {formatDate(u.createdAt)}
                      </TableCell>
                      <TableCell className="text-right py-3">
                        <div className="flex items-center justify-end gap-2">
                          {isSuperAdmin && (
                            <ResetPasswordDialog userId={u.id} userName={u.name} />
                          )}
                          <Link 
                            href={`/dashboard/users/${u.id}`} 
                            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2.5 rounded-lg border-[#D6DED2] hover:bg-[#F7F8F3]/50 text-xs font-semibold transition-premium")}
                          >
                            <Translate namespace="users" translationKey="btn_profile" />
                          </Link>
                          {u.id !== activeUser.id ? (
                            <DeleteConfirm
                              label={`"${u.name}"`}
                              description={t("users.delete_desc")}
                              onConfirm={deleteUser.bind(null, u.id)}
                            />
                          ) : (
                            <span className="text-[10px] text-[#A8B0AA] font-bold px-2 py-1 bg-[#F7F8F3] rounded-lg border border-[#D6DED2]">
                              {t("common.account_self")}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
