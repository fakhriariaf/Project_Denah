import { db } from "@/db";
import {
  projects as projectsTable,
  units as unitsTable,
  customers as customersTable,
  financeAccounts as accountsTable,
  financeCategories as categoriesTable,
} from "@/db/schema/master";
import {
  invoices as invoicesTable,
  payments as paymentsTable,
  transactions as transactionsTable,
  budgets as budgetsTable,
} from "@/db/schema/finance";
import { user as userTable } from "@/db/schema/auth";
import { attachments } from "@/db/schema/system";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser, requireAuth, getSessionRole } from "@/server/permissions";
import FinanceShell from "./finance-shell";

export const revalidate = 0;

export default async function FinancePage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { tab } = searchParams ? await searchParams : { tab: undefined };

  // 1. Authenticate user
  const activeUser = await requireAuth();
  const { isSuperAdmin } = await getSessionRole(activeUser.id);

  // 2. Fetch master data in parallel
  const [
    projectsList,
    unitsList,
    customersList,
    accountsList,
    categoriesList,
    invoicesList,
    paymentsList,
    transactionsList,
    budgetsList,
    usersList,
  ] = await Promise.all([
    db.select().from(projectsTable),
    db.select().from(unitsTable),
    db.select().from(customersTable),
    db.select().from(accountsTable),
    db.select().from(categoriesTable),
    
    // Invoices with project and customer joins
    db
      .select({
        id: invoicesTable.id,
        invoiceNumber: invoicesTable.invoiceNumber,
        projectId: invoicesTable.projectId,
        unitId: invoicesTable.unitId,
        customerId: invoicesTable.customerId,
        bookingId: invoicesTable.bookingId,
        type: invoicesTable.type,
        amount: invoicesTable.amount,
        dueDate: invoicesTable.dueDate,
        status: invoicesTable.status,
        notes: invoicesTable.notes,
        createdAt: invoicesTable.createdAt,
        projectName: projectsTable.name,
        customerName: customersTable.name,
        unitCode: unitsTable.code,
      })
      .from(invoicesTable)
      .innerJoin(projectsTable, eq(invoicesTable.projectId, projectsTable.id))
      .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
      .leftJoin(unitsTable, eq(invoicesTable.unitId, unitsTable.id))
      .orderBy(desc(invoicesTable.createdAt)),

    // Payments with joined details
    db
      .select({
        id: paymentsTable.id,
        invoiceId: paymentsTable.invoiceId,
        paymentNumber: paymentsTable.paymentNumber,
        projectId: paymentsTable.projectId,
        unitId: paymentsTable.unitId,
        customerId: paymentsTable.customerId,
        amount: paymentsTable.amount,
        paymentDate: paymentsTable.paymentDate,
        paymentMethod: paymentsTable.paymentMethod,
        proofAttachmentId: paymentsTable.proofAttachmentId,
        proofFileUrl: attachments.fileUrl,
        status: paymentsTable.status,
        verifiedBy: paymentsTable.verifiedBy,
        verifiedAt: paymentsTable.verifiedAt,
        createdAt: paymentsTable.createdAt,
        projectName: projectsTable.name,
        customerName: customersTable.name,
        unitCode: unitsTable.code,
        invoiceNumber: invoicesTable.invoiceNumber,
      })
      .from(paymentsTable)
      .innerJoin(projectsTable, eq(paymentsTable.projectId, projectsTable.id))
      .leftJoin(customersTable, eq(paymentsTable.customerId, customersTable.id))
      .leftJoin(unitsTable, eq(paymentsTable.unitId, unitsTable.id))
      .leftJoin(invoicesTable, eq(paymentsTable.invoiceId, invoicesTable.id))
      .leftJoin(attachments, eq(paymentsTable.proofAttachmentId, attachments.id))
      .orderBy(desc(paymentsTable.createdAt)),

    // Ledger Transactions
    db
      .select({
        id: transactionsTable.id,
        transactionNumber: transactionsTable.transactionNumber,
        projectId: transactionsTable.projectId,
        unitId: transactionsTable.unitId,
        customerId: transactionsTable.customerId,
        paymentId: transactionsTable.paymentId,
        accountId: transactionsTable.accountId,
        categoryId: transactionsTable.categoryId,
        type: transactionsTable.type,
        description: transactionsTable.description,
        amount: transactionsTable.amount,
        transactionDate: transactionsTable.transactionDate,
        paymentMethod: transactionsTable.paymentMethod,
        approvalStatus: transactionsTable.approvalStatus,
        approvedBy: transactionsTable.approvedBy,
        approvalNotes: transactionsTable.approvalNotes,
        attachmentId: transactionsTable.attachmentId,
        createdBy: transactionsTable.createdBy,
        createdAt: transactionsTable.createdAt,
        projectName: projectsTable.name,
        accountName: accountsTable.name,
        categoryName: categoriesTable.name,
        unitCode: unitsTable.code,
        customerName: customersTable.name,
      })
      .from(transactionsTable)
      .innerJoin(projectsTable, eq(transactionsTable.projectId, projectsTable.id))
      .innerJoin(accountsTable, eq(transactionsTable.accountId, accountsTable.id))
      .innerJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
      .leftJoin(unitsTable, eq(transactionsTable.unitId, unitsTable.id))
      .leftJoin(customersTable, eq(transactionsTable.customerId, customersTable.id))
      .orderBy(desc(transactionsTable.createdAt)),

    // Budgets
    db
      .select({
        id: budgetsTable.id,
        projectId: budgetsTable.projectId,
        name: budgetsTable.name,
        periodStart: budgetsTable.periodStart,
        periodEnd: budgetsTable.periodEnd,
        totalAmount: budgetsTable.totalAmount,
        status: budgetsTable.status,
        createdAt: budgetsTable.createdAt,
        projectName: projectsTable.name,
      })
      .from(budgetsTable)
      .innerJoin(projectsTable, eq(budgetsTable.projectId, projectsTable.id))
      .orderBy(desc(budgetsTable.createdAt)),

    // Users
    db
      .select({
        id: userTable.id,
        name: userTable.name,
      })
      .from(userTable),
  ]);

  // Enrich transactions in memory to link associated customer invoice (for income) or auto-generated invoice (for expense), and resolve approver/verifier name
  const enrichedTransactions = transactionsList.map((trx) => {
    let resolvedApproverName = null;

    // 1. Resolve for income (Masuk) -> find verifier of corresponding payment
    if (trx.type === "income" && trx.paymentId) {
      const payment = paymentsList.find((p) => p.id === trx.paymentId);
      if (payment && payment.verifiedBy) {
        const verifier = usersList.find((u) => u.id === payment.verifiedBy);
        if (verifier) {
          resolvedApproverName = verifier.name;
        }
      }
    }

    // 2. Resolve for expense (Keluar) -> find approvedBy user
    if (trx.type === "expense" && trx.approvedBy) {
      const approver = usersList.find((u) => u.id === trx.approvedBy);
      if (approver) {
        resolvedApproverName = approver.name;
      }
    }

    // Find invoice details
    let invoiceNumber = null;
    let invoiceId = null;

    if (trx.paymentId) {
      const payment = paymentsList.find((p) => p.id === trx.paymentId);
      if (payment && payment.invoiceId) {
        const invoice = invoicesList.find((i) => i.id === payment.invoiceId);
        if (invoice) {
          invoiceNumber = invoice.invoiceNumber;
          invoiceId = invoice.id;
        }
      }
    } else {
      const matchInvoice = invoicesList.find((i) => i.notes === `trxId:${trx.id}`);
      if (matchInvoice) {
        invoiceNumber = matchInvoice.invoiceNumber;
        invoiceId = matchInvoice.id;
      }
    }

    return {
      ...trx,
      invoiceNumber,
      invoiceId,
      resolvedApproverName,
    };
  });

  // Compute current balance per account: openingBalance + income - expense (from verified/approved transactions)
  const balanceMap: Record<string, number> = {};
  for (const acc of accountsList) {
    balanceMap[acc.id] = acc.openingBalance ?? 0;
  }
  for (const trx of transactionsList) {
    if (!(trx.accountId in balanceMap)) balanceMap[trx.accountId] = 0;
    if (trx.type === "income") balanceMap[trx.accountId] += trx.amount;
    else if (trx.type === "expense") balanceMap[trx.accountId] -= trx.amount;
  }

  const enrichedAccounts = accountsList.map((acc) => ({
    ...acc,
    currentBalance: balanceMap[acc.id] ?? acc.openingBalance ?? 0,
  }));

  return (
    <FinanceShell
      activeUser={activeUser}
      isSuperAdmin={isSuperAdmin}
      projects={projectsList}
      units={unitsList}
      customers={customersList}
      accounts={enrichedAccounts}
      categories={categoriesList}
      invoices={invoicesList}
      payments={paymentsList}
      transactions={enrichedTransactions}
      budgets={budgetsList}
      defaultTab={tab as any}
    />
  );
}
