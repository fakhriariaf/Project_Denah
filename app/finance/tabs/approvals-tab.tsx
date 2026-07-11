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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface Transaction {
  id: string;
  transactionNumber: string;
  projectId: string;
  categoryName: string;
  projectName: string;
  description: string;
  amount: number;
  approvalStatus: "not_required" | "pending" | "approved" | "rejected" | "insufficient_balance";
  invoiceNumber?: string | null;
}

interface ApprovalsTabProps {
  pendingApprovals: Transaction[];
  selectedExpense: Transaction | null;
  setSelectedExpense: (expense: any) => void;
  approvalNotes: string;
  setApprovalNotes: (notes: string) => void;
  errorMsg: string | null;
  isSubmitting: boolean;
  onExpenseApprovalSubmit: (isApproved: boolean) => Promise<void>;
}

export function ApprovalsTab({
  pendingApprovals,
  selectedExpense,
  setSelectedExpense,
  approvalNotes,
  setApprovalNotes,
  errorMsg,
  isSubmitting,
  onExpenseApprovalSubmit,
}: ApprovalsTabProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <Card className="bg-card border-input">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">{t("finance.approval_title")}</CardTitle>
          <CardDescription className="text-xs">
            {t("finance.approval_desc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("finance.col_trx_code")}</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>{t("finance.col_category")}</TableHead>
                <TableHead>{t("finance.col_project")}</TableHead>
                <TableHead>{t("finance.col_need_desc")}</TableHead>
                <TableHead className="text-right">{t("finance.col_amount")}</TableHead>
                <TableHead className="text-center">{t("finance.col_balance_avail")}</TableHead>
                <TableHead className="text-center">{t("finance.col_action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingApprovals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-16 w-16 rounded-full bg-secondary/50 flex items-center justify-center mx-auto">
                        <Clock className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{t("finance.approval_empty")}</p>
                        <p className="text-xs text-muted-foreground mt-1">{t("finance.approval_empty_desc")}</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pendingApprovals.map((exp) => (
                  <TableRow key={exp.id}>
                    <TableCell className="font-mono text-xs font-semibold text-foreground">
                      {exp.transactionNumber}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {exp.invoiceNumber || "—"}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-foreground">
                      {exp.categoryName}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {exp.projectName}
                    </TableCell>
                    <TableCell className="text-xs text-foreground">
                      {exp.description}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold tabular-nums text-xs text-foreground">
                      Rp {exp.amount.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="text-center">
                      {exp.approvalStatus === "insufficient_balance" ? (
                        <Badge className="bg-rose-50 text-danger border-rose-200 flex items-center gap-1 w-fit mx-auto text-[10px]">
                          <AlertTriangle className="h-3 w-3" /> {t("finance.badge_insuff")}
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 flex items-center gap-1 w-fit mx-auto text-[10px]">
                          <CheckCircle2 className="h-3 w-3" /> {t("finance.badge_avail")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        onClick={() => {
                          setSelectedExpense(exp);
                          setApprovalNotes("");
                        }}
                        className="bg-primary hover:bg-[#8FAF9A] text-white text-xs h-7 py-0.5 px-2"
                      >
                        {t("finance.btn_review")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedExpense} onOpenChange={(open) => { if (!open) setSelectedExpense(null); }}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>{t("finance.auth_title")}</DialogTitle>
            <DialogDescription>{t("finance.auth_desc")}</DialogDescription>
          </DialogHeader>
          {errorMsg && (
            <div className="p-3 bg-rose-50 text-danger border border-rose-100 rounded-md text-xs font-semibold mb-3">
              {errorMsg}
            </div>
          )}
          {selectedExpense && (
            <div className="space-y-4 font-sans">
              <div className="p-3 bg-slate-50 border border-border rounded-md space-y-1">
                <p className="text-xs">{t("finance.auth_lbl_trx")} <span className="font-mono font-semibold">{selectedExpense.transactionNumber}</span></p>
                <p className="text-xs">{t("finance.auth_lbl_need")} <span className="font-semibold">{selectedExpense.description}</span></p>
                <p className="text-xs">{t("finance.auth_lbl_amount")} <span className="font-mono font-bold text-danger">Rp {selectedExpense.amount.toLocaleString("id-ID")}</span></p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">{t("finance.auth_lbl_notes")}</label>
                <Input
                  placeholder={t("finance.auth_notes_ph")}
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  className="bg-card border-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3">
                <Button
                  onClick={() => onExpenseApprovalSubmit(false)}
                  className="bg-card text-danger border border-rose-200 hover:bg-rose-50"
                  disabled={isSubmitting}
                >
                  {t("finance.auth_btn_reject")}
                </Button>
                <Button
                  onClick={() => onExpenseApprovalSubmit(true)}
                  className="bg-primary hover:bg-[#8FAF9A] text-white"
                  disabled={
                    isSubmitting ||
                    selectedExpense.approvalStatus === "insufficient_balance"
                  }
                >
                  {t("finance.auth_btn_approve")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
