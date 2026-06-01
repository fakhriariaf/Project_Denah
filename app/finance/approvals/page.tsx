import { requireAuth, getSessionRole } from "@/server/permissions";
import { redirect } from "next/navigation";
import { getFinancePageData } from "@/server/actions/finance";
import FinanceShell from "../finance-shell";

export const revalidate = 0;

export default async function FinanceApprovalsPage() {
  // 1. Authenticate user + RBAC: only Admin Keuangan, Direksi, Admin Kantor, Super Admin
  const activeUser = await requireAuth();
  const { isKeuangan, isDireksi, isSuperAdmin, isAdminKantor } = await getSessionRole(activeUser.id);
  if (!isKeuangan && !isDireksi && !isSuperAdmin && !isAdminKantor) {
    redirect("/unauthorized");
  }

  // 2. Load all finance data via shared loader (query + enrichment centralized)
  const data = await getFinancePageData();

  return (
    <FinanceShell
      activeUser={activeUser}
      isSuperAdmin={isSuperAdmin}
      projects={data.projects}
      units={data.units}
      customers={data.customers}
      accounts={data.accounts}
      categories={data.categories}
      invoices={data.invoices}
      payments={data.payments}
      transactions={data.transactions}
      budgets={data.budgets}
      defaultTab="approvals"
    />
  );
}
