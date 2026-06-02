import { requireAuth, getSessionRole } from "@/server/permissions";
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

  // 1. Authenticate user + RBAC guard
  const activeUser = await requireAuth();
  const { isSuperAdmin, isKeuangan, isDireksi, isAdminKantor, isMarketing, isMarketingManager, isPengawas } = await getSessionRole(activeUser.id);

  // Only finance-relevant roles may access this page
  const hasAccess = isSuperAdmin || isKeuangan || isDireksi || isAdminKantor || isMarketing || isMarketingManager || isPengawas;
  if (!hasAccess) {
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
      defaultTab={tab as any}
    />
  );
}
