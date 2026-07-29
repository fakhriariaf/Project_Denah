import { requireAuth, getSessionRole, canAccessFinanceModule } from "@/server/permissions";
import { redirect } from "next/navigation";
import { getFinancePageData } from "@/server/actions/finance";
import FinanceShell from "./finance-shell";

export const revalidate = 0;

export default async function FinancePage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { tab } = searchParams ? await searchParams : { tab: undefined };

  // 1. Authenticate user + RBAC guard — uses shared helper (Req 11.1, 11.2)
  const activeUser = await requireAuth();
  const { role, isSuperAdmin, isDireksi, isKeuangan, isAdminKantor } =
    await getSessionRole(activeUser.id);

  if (!canAccessFinanceModule(role)) {
    redirect("/unauthorized");
  }

  // 2. Load all finance data via shared loader (query + enrichment centralized)
  const data = await getFinancePageData();

  return (
    <FinanceShell
      activeUser={activeUser}
      isSuperAdmin={isSuperAdmin}
      canApproveExpense={isDireksi || isSuperAdmin}
      // Mirrors the server-side role gate on `createPayment` so the "Catat
      // Pembayaran" trigger is not shown to roles whose submit would be rejected.
      canRecordPayment={isSuperAdmin || isKeuangan || isAdminKantor}
      projects={data.projects}
      units={data.units}
      customers={data.customers}
      accounts={data.accounts}
      categories={data.categories}
      invoices={data.invoices}
      payments={data.payments}
      transactions={data.transactions}
      budgets={data.budgets}
      budgetLines={data.budgetLines}
      budgetActualUsage={data.budgetActualUsage}
      defaultTab={tab as any}
    />
  );
}
