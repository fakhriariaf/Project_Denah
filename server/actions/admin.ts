"use server";

import { db } from "@/db";
import { requireRole } from "@/server/permissions";
import { writeAuditLog } from "@/server/services/audit.service";
import { revalidatePath } from "next/cache";

// Master
import { projects, units, customers, vendors, projectUsers, siteplans, siteplanShapes, unitStatusHistories, financeAccounts, financeCategories } from "@/db/schema/master";
// Marketing
import { leads, customerFollowups, bookings, bookingStatusHistories, kprProcesses, bankPartners, bankSubmissions, customerDocuments, waitingLists, marketingTargets } from "@/db/schema/marketing";
// Production
import { workItems, spks, spmbs, spkWorkItemWeights, spkProgressLogs, materialRequests, handoverEstimations, complaints } from "@/db/schema/production";
// Finance
import { invoices, payments, transactions, transactionApprovals, budgets, budgetLines } from "@/db/schema/finance";

export async function resetSimulatedData(mode: "transactions_only" | "all_data") {
  const user = await requireRole("Super Admin");

  await db.transaction(async (tx) => {
    // 1. Marketing
    await tx.delete(customerFollowups).run();
    await tx.delete(leads).run();
    await tx.delete(customerDocuments).run();
    await tx.delete(bankSubmissions).run();
    await tx.delete(kprProcesses).run();
    await tx.delete(bookingStatusHistories).run();
    await tx.delete(bookings).run();
    await tx.delete(waitingLists).run();
    await tx.delete(marketingTargets).run();

    // 2. Production
    await tx.delete(complaints).run();
    await tx.delete(handoverEstimations).run();
    await tx.delete(materialRequests).run();
    await tx.delete(spkProgressLogs).run();
    await tx.delete(spkWorkItemWeights).run();
    await tx.delete(spmbs).run();
    await tx.delete(spks).run();

    // 3. Finance
    await tx.delete(transactionApprovals).run();
    await tx.delete(transactions).run();
    await tx.delete(payments).run();
    await tx.delete(invoices).run();
    await tx.delete(budgetLines).run();
    await tx.delete(budgets).run();

    // 4. Master (Transactions part)
    await tx.delete(unitStatusHistories).run();

    if (mode === "all_data") {
      // 5. Master (Core data)
      await tx.delete(siteplanShapes).run();
      await tx.delete(units).run();
      await tx.delete(siteplans).run();
      await tx.delete(projectUsers).run();
      await tx.delete(projects).run();
      await tx.delete(customers).run();
      await tx.delete(vendors).run();
      
      // Reference data
      await tx.delete(workItems).run();
      await tx.delete(bankPartners).run();
      await tx.delete(financeAccounts).run();
      await tx.delete(financeCategories).run();
    } else {
      // If transactions only, reset unit statuses AND clear all foreign references
      await tx.update(units).set({
        status: "available",
        currentSpkId: null,
        currentCustomerId: null,
        currentBookingId: null,
        constructionProgress: 0,
      }).run();
    }
  });

  await writeAuditLog({
    action: "delete",
    module: "system",
    entityId: "all_simulated_data",
    entityType: "database",
    details: { mode }
  });

  revalidatePath("/", "layout");
  return { success: true };
}
