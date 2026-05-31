import { requireAuth, getSessionRole } from "@/server/permissions";
import { 
  getExecutiveOverviewData, 
  getVendorDashboardData, 
  getFieldSupervisorDashboardData 
} from "@/server/actions/reports";
import { checkFollowupReminders } from "@/server/actions/marketing";
import { checkPaymentReminders } from "@/server/actions/finance";
import DashboardShell from "@/components/dashboard/dashboard-shell";
import { VendorDashboardShell } from "@/components/dashboard/vendor-dashboard-shell";
import { FieldSupervisorDashboardShell } from "@/components/dashboard/field-supervisor-dashboard-shell";

export const revalidate = 0;

export default async function DashboardPage() {
  const activeUser = await requireAuth();
  
  const userRoles = await getSessionRole(activeUser.id);

  if (userRoles.isVendor) {
    const data = await getVendorDashboardData();
    return (
      <VendorDashboardShell
        data={data}
        userName={activeUser.name || "Vendor"}
      />
    );
  }

  if (userRoles.isPengawas && !userRoles.isSuperAdmin) {
    const data = await getFieldSupervisorDashboardData();
    return (
      <FieldSupervisorDashboardShell
        data={data}
        userName={activeUser.name || "Pengawas Lapangan"}
      />
    );
  }

  const stats = await getExecutiveOverviewData();

  // Auto-trigger reminder scans concurrently and safely wait for execution to finish
  try {
    await Promise.allSettled([
      checkFollowupReminders(),
      checkPaymentReminders()
    ]);
  } catch (err) {
    console.error("Failed to run dashboard background scans:", err);
  }

  return (
    <DashboardShell
      stats={stats}
      userRoles={userRoles}
      userName={activeUser.name || "User"}
    />
  );
}

