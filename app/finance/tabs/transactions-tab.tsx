"use client";

import * as React from "react";
import { useI18n } from "@/lib/i18n";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CircleDollarSign, TrendingDown } from "lucide-react";

interface Transaction {
  id: string;
  transactionNumber: string;
  projectId: string;
  type: "income" | "expense";
  description: string;
  amount: number;
  approvalStatus: "not_required" | "pending" | "approved" | "rejected" | "insufficient_balance";
  accountName: string;
  invoiceNumber?: string | null;
  resolvedApproverName?: string | null;
}

interface Account {
  id: string;
  code: string;
  name: string;
  type: "cash" | "bank" | "receivable" | "payable" | "income" | "expense";
  openingBalance: number;
  currentBalance: number;
  status: "active" | "inactive";
}

interface TransactionsTabProps {
  filteredTransactions: Transaction[];
  accounts: Account[];
  projects: Array<{ id: string; name: string; code: string }>;
  categories: Array<{
    id: string;
    name: string;
    type: "income" | "expense";
    status: "active" | "inactive";
  }>;
  expenseForm: {
    projectId: string;
    accountId: string;
    categoryId: string;
    amount: string;
    description: string;
    transactionDate: string;
    paymentMethod: "cash" | "transfer" | "giro" | "other";
  };
  setExpenseForm: React.Dispatch<React.SetStateAction<{
    projectId: string;
    accountId: string;
    categoryId: string;
    amount: string;
    description: string;
    transactionDate: string;
    paymentMethod: "cash" | "transfer" | "giro" | "other";
  }>>;
  errorMsg: string | null;
  isSubmitting: boolean;
  onCreateExpenseSubmit: (e: React.FormEvent) => Promise<void>;
}

export function TransactionsTab({
  filteredTransactions,
  accounts,
  projects,
  categories,
  expenseForm,
  setExpenseForm,
  errorMsg,
  isSubmitting,
  onCreateExpenseSubmit,
}: TransactionsTabProps) {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card className="bg-white border-[#D6DED2]">
          <CardHeader>
            <CardTitle className="text-lg text-[#243028]">{t("finance.ledger_title")}</CardTitle>
            <CardDescription className="text-xs">{t("finance.ledger_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("finance.col_trx_code")}</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>{t("finance.col_description")}</TableHead>
                  <TableHead>{t("finance.col_type")}</TableHead>
                  <TableHead>Verifikator / Approver</TableHead>
                  <TableHead>{t("finance.col_account")}</TableHead>
                  <TableHead className="text-right">{t("finance.col_amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-16 w-16 rounded-full bg-[#DDE8D8]/50 flex items-center justify-center mx-auto">
                          <CircleDollarSign className="h-8 w-8 text-[#4F6F52]" />
                        </div>
                        <div>
                          <p className="font-semibold text-[#243028] text-sm">{t("finance.ledger_empty")}</p>
                          <p className="text-xs text-[#66736A] mt-1">{t("finance.ledger_empty_desc")}</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((trx) => (
                    <TableRow key={trx.id}>
                      <TableCell className="font-mono text-xs font-semibold text-[#243028]">
                        {trx.transactionNumber}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[#66736A]">
                        {trx.invoiceNumber || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-[#243028]">
                        {trx.description}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge
                          className={
                            trx.type === "income"
                              ? "bg-[#DDE8D8] text-[#4F6F52]"
                              : trx.approvalStatus === "approved"
                              ? "bg-[#DDE8D8] text-[#4F6F52]"
                              : trx.approvalStatus === "rejected" || trx.approvalStatus === "insufficient_balance"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }
                        >
                          {trx.type === "income"
                            ? t("finance.trx_type_in")
                            : trx.approvalStatus === "approved"
                            ? "Keluar - Disetujui"
                            : trx.approvalStatus === "rejected"
                            ? "Keluar - Tolak"
                            : trx.approvalStatus === "insufficient_balance"
                            ? "Keluar - Tolak"
                            : "Keluar - Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-[#243028] font-medium">
                        {trx.resolvedApproverName || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-[#66736A]">
                        {trx.accountName}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold tabular-nums text-xs text-[#243028]">
                        Rp {trx.amount.toLocaleString("id-ID")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Right sidebar: Cash Request submit form & balances */}
      <div className="space-y-6">
        <Card className="bg-white/70 backdrop-blur-md border border-[#D6DED2]/80 shadow-sage hover:shadow-sage-lg transition-premium rounded-3xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-[#243028]">{t("finance.balance_title")}</CardTitle>
            <CardDescription className="text-xs text-[#66736A] font-medium">{t("finance.balance_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3 font-sans">
            {accounts.filter(a => a.status === "active").map(acc => {
              const diff = acc.currentBalance - acc.openingBalance;
              return (
                <div
                  key={acc.id}
                  className="flex justify-between items-center p-3.5 bg-gradient-to-r from-white to-[#F7F8F3] border border-[#D6DED2] rounded-2xl hover:border-[#8FAF9A] hover:shadow-sage transition-premium duration-300 group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${acc.currentBalance > 0 ? "bg-[#8FAF9A]" : "bg-rose-400"} group-hover:scale-150 transition-premium`} />
                    <div>
                      <p className="text-xs font-bold text-[#243028]">{acc.name}</p>
                      <p className="text-[10px] text-[#66736A] font-mono uppercase tracking-wider mt-0.5">{acc.code}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className={`font-mono font-extrabold text-xs tabular-nums ${acc.currentBalance < 0 ? "text-rose-600" : "text-[#4F6F52]"}`}>
                      Rp {acc.currentBalance.toLocaleString("id-ID")}
                    </span>
                    {diff !== 0 && (
                      <span className={`text-[9px] font-mono tabular-nums ${diff >= 0 ? "text-emerald-500" : "text-rose-400"}`}>
                        {diff >= 0 ? "+" : ""}{diff.toLocaleString("id-ID")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="bg-white border-[#D6DED2] shadow-sage rounded-2xl overflow-hidden hover:shadow-sage-lg transition-premium">
          <div className="bg-[#4F6F52] h-1 w-full" />
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-[#243028] flex items-center gap-2">
              <TrendingDown className="h-4.5 w-4.5 text-[#D77A7A]" />
              {t("finance.expense_title")}
            </CardTitle>
            <CardDescription className="text-xs text-[#66736A] font-medium">
              {t("finance.expense_desc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 font-sans space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-50 text-[#8B3443] border border-rose-100 rounded-xl text-xs font-semibold animate-shake">
                {errorMsg}
              </div>
            )}

            <form onSubmit={onCreateExpenseSubmit} className="space-y-4">
              {/* Project Selector field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#243028] uppercase tracking-wider block">{t("finance.expense_lbl_project")}</label>
                <Select
                  value={expenseForm.projectId}
                  onValueChange={(val) => setExpenseForm(f => ({ ...f, projectId: val || "" }))}
                  items={projects.map(p => ({ label: p.name, value: p.id }))}
                >
                  <SelectTrigger className="bg-[#F7F8F3] border-[#D6DED2] rounded-xl focus:ring-[#4F6F52] font-semibold text-xs h-9.5 text-[#243028]">
                    <SelectValue placeholder={t("finance.expense_lbl_project")}>
                      {expenseForm.projectId ? projects.find(p => p.id === expenseForm.projectId)?.name : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="border-[#D6DED2] rounded-xl">
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-xs font-medium">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cash Account & Category Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#243028] uppercase tracking-wider block">{t("finance.expense_lbl_account")}</label>
                  <Select
                    value={expenseForm.accountId}
                    onValueChange={(val) => setExpenseForm(f => ({ ...f, accountId: val || "" }))}
                    items={accounts.map(a => ({ label: a.name, value: a.id }))}
                  >
                    <SelectTrigger className="bg-[#F7F8F3] border-[#D6DED2] rounded-xl focus:ring-[#4F6F52] font-semibold text-xs h-9.5 text-[#243028]">
                      <SelectValue placeholder={t("finance.expense_lbl_account")}>
                        {expenseForm.accountId ? accounts.find(a => a.id === expenseForm.accountId)?.name : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="border-[#D6DED2] rounded-xl">
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={a.id} className="text-xs font-medium">{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#243028] uppercase tracking-wider block">{t("finance.expense_lbl_category")}</label>
                  <Select
                    value={expenseForm.categoryId}
                    onValueChange={(val) => setExpenseForm(f => ({ ...f, categoryId: val || "" }))}
                    items={categories.filter(c => c.type === "expense").map(c => ({ label: c.name, value: c.id }))}
                  >
                    <SelectTrigger className="bg-[#F7F8F3] border-[#D6DED2] rounded-xl focus:ring-[#4F6F52] font-semibold text-xs h-9.5 text-[#243028]">
                      <SelectValue placeholder={t("finance.expense_lbl_category")}>
                        {expenseForm.categoryId ? categories.find(c => c.id === expenseForm.categoryId)?.name : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="border-[#D6DED2] rounded-xl">
                      {categories.filter(c => c.type === "expense").map(c => (
                        <SelectItem key={c.id} value={c.id} className="text-xs font-medium">{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Amount & Method Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#243028] uppercase tracking-wider block">{t("finance.expense_lbl_amount")}</label>
                  <Input
                    type="number"
                    placeholder="Rp 0"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                    className="bg-[#F7F8F3] border-[#D6DED2] rounded-xl focus-visible:ring-[#4F6F52] font-mono font-bold text-xs h-9.5 text-[#243028]"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#243028] uppercase tracking-wider block">{t("finance.expense_lbl_method")}</label>
                  <Select
                    value={expenseForm.paymentMethod}
                    onValueChange={(val: any) => setExpenseForm(f => ({ ...f, paymentMethod: val }))}
                    items={[
                      { label: t("finance.payment_method_transfer"), value: "transfer" },
                      { label: t("finance.payment_method_cash"), value: "cash" },
                      { label: t("finance.payment_method_giro"), value: "giro" },
                    ]}
                  >
                    <SelectTrigger className="bg-[#F7F8F3] border-[#D6DED2] rounded-xl focus:ring-[#4F6F52] font-semibold text-xs h-9.5 text-[#243028]">
                      <SelectValue placeholder={t("finance.expense_lbl_method")}>
                        {expenseForm.paymentMethod === "transfer" && t("finance.payment_method_transfer")}
                        {expenseForm.paymentMethod === "cash" && t("finance.payment_method_cash")}
                        {expenseForm.paymentMethod === "giro" && t("finance.payment_method_giro")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="border-[#D6DED2] rounded-xl">
                      <SelectItem value="transfer" className="text-xs font-medium">{t("finance.payment_method_transfer")}</SelectItem>
                      <SelectItem value="cash" className="text-xs font-medium">{t("finance.payment_method_cash")}</SelectItem>
                      <SelectItem value="giro" className="text-xs font-medium">{t("finance.payment_method_giro")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dynamic Readable Amount Live Preview Card */}
              {expenseForm.amount && !isNaN(Number(expenseForm.amount)) && (
                <div className="p-3 bg-[#DDE8D8]/50 border border-[#8FAF9A]/30 rounded-xl space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                  <span className="text-[9px] font-bold text-[#66736A] uppercase tracking-wider block">{t("finance.invoice_format_rupiah")}</span>
                  <span className="font-mono font-extrabold text-sm text-[#4F6F52] tracking-tight tabular-nums">
                    Rp {Number(expenseForm.amount).toLocaleString("id-ID")}
                  </span>
                </div>
              )}

              {/* Description Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#243028] uppercase tracking-wider block">{t("finance.expense_lbl_notes")}</label>
                <Input
                  placeholder={t("finance.expense_notes_ph")}
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                  className="bg-[#F7F8F3] border-[#D6DED2] rounded-xl focus-visible:ring-[#4F6F52] font-medium text-xs h-9.5 text-[#243028]"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-[#4F6F52] hover:bg-[#3D563F] text-white text-xs font-bold h-10 rounded-xl shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium"
                disabled={isSubmitting}
              >
                {isSubmitting ? t("finance.submitting") : t("finance.expense_btn_submit")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
