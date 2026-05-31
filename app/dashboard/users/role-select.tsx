"use client";

import { useState, useTransition, useEffect } from "react";
import { updateUserRole } from "@/server/actions/users";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Check, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type RoleOption = { id: string; name: string };

export function RoleSelect({
  userId,
  currentRoleId,
  roles,
}: {
  userId: string;
  currentRoleId: string | null;
  roles: RoleOption[];
}) {
  const { t } = useI18n();
  const [selectedRole, setSelectedRole] = useState(currentRoleId ?? "");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSelectedRole(currentRoleId ?? "");
  }, [currentRoleId]);

  const handleChange = (roleId: string) => {
    setSelectedRole(roleId);
    startTransition(async () => {
      try {
        await updateUserRole(userId, roleId);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } catch (err) {
        // Rollback on error
        setSelectedRole(currentRoleId ?? "");
        alert(err instanceof Error ? err.message : t("users.create_error"));
      }
    });
  };

  return (
    <div className="flex items-center gap-1">
      <Select
        value={selectedRole}
        onValueChange={(v) => handleChange(v ?? "")}
        disabled={isPending}
        items={roles.map(r => ({ label: r.name, value: r.id }))}
      >
        <SelectTrigger className="h-7 text-xs w-[160px]">
          <SelectValue placeholder={t("users.label_role")}>
            {selectedRole ? roles.find(r => r.id === selectedRole)?.name : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {roles.map((r) => (
            <SelectItem key={r.id} value={r.id} className="text-xs">{r.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      {saved && <Check className="h-3 w-3 text-green-600" />}
    </div>
  );
}
