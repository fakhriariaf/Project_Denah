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

  // Auto-trigger reminder scans concurrently (non-blocking, errors logged individually)
  Promise.allSettled([
    checkFollowupReminders(),
    checkPaymentReminders()
  ]).then((results) => {
    for (const result of results) {
      if (result.status === "rejected") {
        console.error("Dashboard background scan failed:", result.reason);
      }
    }
  });


  return (
    <DashboardShell
      stats={stats}
      userRoles={userRoles}
      userName={activeUser.name || "User"}
    />
  );
}

