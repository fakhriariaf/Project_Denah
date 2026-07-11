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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Eye,
} from "lucide-react";
import type { PaginatedResult } from "@/lib/pagination";

type PaymentListItem = {
  id: string;
  paymentNumber: string;
  projectId: string;
  unitId: string | null;
  customerId: string | null;
  amount: number;
  paymentDate: Date;
  paymentMethod: "cash" | "transfer" | "giro" | "other";
  proofAttachmentId: string | null;
  proofFileUrl?: string | null;
  status: "pending" | "verified" | "rejected";
  verifiedBy: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  projectName: string;
  customerName: string | null;
  unitCode: string | null;
  invoiceNumber: string | null;
  invoiceId?: string | null;
};

interface PaymentsTabProps {
  projects: Array<{ id: string; name: string; code: string }>;
  units: Array<{ id: string; code: string; projectId: string; price: number }>;
  customers: Array<{ id: string; name: string; phone: string }>;
  accounts: Array<{
    id: string;
    code: string;
    name: string;
    type: "cash" | "bank" | "receivable" | "payable" | "income" | "expense";
    openingBalance: number;
    currentBalance: number;
    status: "active" | "inactive";
  }>;
  initialInvoices: Array<{
    id: string;
    invoiceNumber: string;
    projectId: string;
    unitId: string | null;
    customerId: string | null;
    bookingId: string | null;
    type: "booking_fee" | "dp" | "installment" | "other";
    amount: number;
    dueDate: Date | null;
    status: "unpaid" | "partial" | "paid" | "cancelled";
    notes: string | null;
    createdAt: Date;
    projectName: string;
    customerName: string | null;
    unitCode: string | null;
  }>;
  initialPayments: Array<{
    id: string;
    invoiceId: string | null;
    paymentNumber: string;
    projectId: string;
    unitId: string | null;
    customerId: string | null;
    amount: number;
    paymentDate: Date;
    paymentMethod: "cash" | "transfer" | "giro" | "other";
    proofAttachmentId: string | null;
    proofFileUrl?: string | null;
    status: "pending" | "verified" | "rejected";
    verifiedBy: string | null;
    verifiedAt: Date | null;
    createdAt: Date;
    projectName: string;
    customerName: string | null;
    unitCode: string | null;
    invoiceNumber: string | null;
  }>;
  paymentPageData: PaginatedResult<PaymentListItem>;
  paymentForm: {
    invoiceId: string;
    projectId: string;
    unitId: string;
    customerId: string;
    amount: string;
    paymentDate: string;
    paymentMethod: "cash" | "transfer" | "giro" | "other";
  };
  setPaymentForm: React.Dispatch<React.SetStateAction<{
    invoiceId: string;
    projectId: string;
    unitId: string;
    customerId: string;
    amount: string;
    paymentDate: string;
    paymentMethod: "cash" | "transfer" | "giro" | "other";
  }>>;
  paymentOpen: boolean;
  setPaymentOpen: (open: boolean) => void;
  selectedPayment: any;
  setSelectedPayment: (payment: any) => void;
  verificationAccount: string;
  setVerificationAccount: (account: string) => void;
  verificationNotes: string;
  setVerificationNotes: (notes: string) => void;
  errorMsg: string | null;
  isSubmitting: boolean;
  isSuperAdmin: boolean;
  onCreatePaymentSubmit: (e: React.FormEvent) => Promise<void>;
  onVerifyPaymentSubmit: (isApproved: boolean) => Promise<void>;
  onDeletePaymentSubmit: () => Promise<void>;
}

export function PaymentsTab({
  projects,
  units,
  customers,
  accounts,
  initialInvoices,
  initialPayments,
  paymentPageData,
  paymentForm,
  setPaymentForm,
  paymentOpen,
  setPaymentOpen,
  selectedPayment,
  setSelectedPayment,
  verificationAccount,
  setVerificationAccount,
  verificationNotes,
  setVerificationNotes,
  errorMsg,
  isSubmitting,
  isSuperAdmin,
  onCreatePaymentSubmit,
  onVerifyPaymentSubmit,
  onDeletePaymentSubmit,
}: PaymentsTabProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      {/* Verification queue for Keuangan */}
      <Card className="bg-white/70 backdrop-blur-md border border-border/80 shadow-sage hover:shadow-sage-lg transition-premium rounded-3xl">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-bold text-foreground">{t("finance.verify_queue_title")}</CardTitle>
            <CardDescription className="text-xs text-muted-foreground font-medium">{t("finance.verify_queue_desc")}</CardDescription>
          </div>
          <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
            <DialogTrigger nativeButton={true} render={
              <Button className="bg-[#8FAF9A] hover:bg-primary text-white flex items-center gap-1.5 text-xs px-2.5 h-8.5 rounded-xl btn-premium">
                <Plus className="h-3.5 w-3.5" /> {t("finance.payment_btn_new")}
              </Button>
            } />
            <DialogContent className="bg-popover backdrop-blur-md border-border shadow-sage-lg rounded-3xl p-6 max-w-md sm:max-w-xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-foreground">{t("finance.payment_form_title")}</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">{t("finance.payment_form_desc")}</DialogDescription>
              </DialogHeader>
              {errorMsg && (
                <div className="p-3 bg-rose-50 text-[#8B3443] border border-rose-100 rounded-xl text-xs font-semibold animate-shake">
                  {errorMsg}
                </div>
              )}
              <form onSubmit={onCreatePaymentSubmit} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider block">{t("finance.payment_lbl_invoice")}</label>
                  <Select
                    value={paymentForm.invoiceId}
                    onValueChange={(val) => {
                      if (!val) return;
                      const found = initialInvoices.find(inv => inv.id === val);
                      if (found) {
                        setPaymentForm(f => ({
                          ...f,
                          invoiceId: val,
                          projectId: found.projectId,
                          unitId: found.unitId || "",
                          customerId: found.customerId || "",
                          amount: found.amount.toString(),
                        }));
                      }
                    }}
                    items={initialInvoices.filter(i => i.status !== "paid").map(i => ({ label: `${i.invoiceNumber} - ${i.customerName} (Rp ${i.amount.toLocaleString()})`, value: i.id }))}
                  >
                    <SelectTrigger className="bg-muted/30 border-border rounded-xl focus:ring-ring font-semibold text-xs h-9.5 text-foreground">
                      <SelectValue placeholder={t("finance.verify_lbl_deposit_account")}>
                        {paymentForm.invoiceId ? (() => {
                          const inv = initialInvoices.find(i => i.id === paymentForm.invoiceId);
                          return inv ? `${inv.invoiceNumber} - ${inv.customerName} (Rp ${inv.amount.toLocaleString("id-ID")})` : undefined;
                        })() : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="border-border rounded-xl">
                      {initialInvoices.filter(i => i.status !== "paid").map(i => (
                        <SelectItem key={i.id} value={i.id} className="text-xs font-medium">{i.invoiceNumber} - {i.customerName} (Rp {i.amount.toLocaleString()})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider block">{t("finance.payment_lbl_project")}</label>
                    <Select
                      value={paymentForm.projectId}
                      onValueChange={(val) => setPaymentForm(f => ({ ...f, projectId: val || "" }))}
                      items={projects.map(p => ({ label: p.name, value: p.id }))}
                    >
                      <SelectTrigger className="bg-muted/30 border-border rounded-xl focus:ring-ring font-semibold text-xs h-9.5 text-foreground">
                        <SelectValue placeholder={t("finance.payment_lbl_project")}>
                          {paymentForm.projectId ? projects.find(p => p.id === paymentForm.projectId)?.name : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="border-border rounded-xl">
                        {projects.map(p => (
                          <SelectItem key={p.id} value={p.id} className="text-xs font-medium">{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider block">{t("finance.payment_lbl_amount")}</label>
                    <Input
                      type="number"
                      placeholder="Rp 0"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                      className="bg-muted/30 border-border rounded-xl focus-visible:ring-ring font-mono font-bold text-xs h-9.5 text-foreground"
                      required
                    />
                  </div>
                </div>

                {paymentForm.amount && !isNaN(Number(paymentForm.amount)) && (
                  <div className="p-2.5 bg-secondary/50 border border-primary/30 rounded-xl space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">{t("finance.invoice_format_rupiah")}</span>
                    <span className="font-mono font-extrabold text-sm text-primary tracking-tight tabular-nums">
                      Rp {Number(paymentForm.amount).toLocaleString("id-ID")}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider block">{t("finance.payment_lbl_method")}</label>
                    <Select
                      value={paymentForm.paymentMethod}
                      onValueChange={(val: any) => setPaymentForm(f => ({ ...f, paymentMethod: val }))}
                      items={[
                        { label: t("finance.payment_method_transfer"), value: "transfer" },
                        { label: t("finance.payment_method_cash"), value: "cash" },
                        { label: t("finance.payment_method_giro"), value: "giro" },
                        { label: t("finance.payment_method_other"), value: "other" },
                      ]}
                    >
                      <SelectTrigger className="bg-muted/30 border-border rounded-xl focus:ring-ring font-semibold text-xs h-9.5 text-foreground">
                        <SelectValue placeholder={t("finance.payment_lbl_method")}>
                          {paymentForm.paymentMethod === "transfer" && t("finance.payment_method_transfer")}
                          {paymentForm.paymentMethod === "cash" && t("finance.payment_method_cash")}
                          {paymentForm.paymentMethod === "giro" && t("finance.payment_method_giro")}
                          {paymentForm.paymentMethod === "other" && t("finance.payment_method_other")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="border-border rounded-xl">
                        <SelectItem value="transfer" className="text-xs font-medium">{t("finance.payment_method_transfer")}</SelectItem>
                        <SelectItem value="cash" className="text-xs font-medium">{t("finance.payment_method_cash")}</SelectItem>
                        <SelectItem value="giro" className="text-xs font-medium">{t("finance.payment_method_giro")}</SelectItem>
                        <SelectItem value="other" className="text-xs font-medium">{t("finance.payment_method_other")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider block">{t("finance.payment_lbl_date")}</label>
                    <Input
                      type="date"
                      value={paymentForm.paymentDate}
                      onChange={(e) => setPaymentForm(f => ({ ...f, paymentDate: e.target.value }))}
                      className="bg-muted/30 border-border rounded-xl focus-visible:ring-ring font-medium text-xs h-9.5 text-foreground"
                      required
                    />
                  </div>
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-white text-xs font-bold h-10 rounded-xl shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? t("finance.saving") : t("finance.payment_btn_submit")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="p-0 space-y-3 px-4 pb-4">
          {paymentPageData.data.filter(p => p.status === "pending").length === 0 ? (
            <div className="text-center py-8 text-muted-foreground/70 text-xs font-medium">
              {t("finance.payment_empty")}
            </div>
          ) : (
            paymentPageData.data.filter(p => p.status === "pending").map((pay) => (
              <Card key={pay.id} className="p-4 border border-border bg-gradient-to-br from-white to-[#F7F8F3] shadow-sm rounded-2xl hover:border-primary/50 hover:shadow-sage transition-premium duration-300 space-y-3 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#E9C46A]" />
                <div className="flex justify-between items-start pl-1">
                  <div>
                    <p className="font-mono text-xs font-bold text-foreground">{pay.paymentNumber}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Customer: <span className="font-semibold text-foreground">{pay.customerName || "â€”"}</span>
                    </p>
                  </div>
                  <Badge className="bg-[#FFF2C2] text-[#9A7D21] border border-[#E9C46A]/30 text-[10px] rounded-full px-2 py-0.5">
                    {t("finance.payment_pending")}
                  </Badge>
                </div>

                <div className="flex justify-between items-center text-xs pl-1">
                  <span className="font-mono font-extrabold text-sm text-primary tabular-nums">
                    Rp {pay.amount.toLocaleString("id-ID")}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold bg-secondary/50 px-2 py-0.5 rounded-md">
                    {pay.paymentMethod}
                  </span>
                </div>

                <Button
                  onClick={() => {
                    setSelectedPayment(pay);
                    if (accounts.length > 0) {
                      setVerificationAccount(accounts[0].id);
                    }
                    setVerificationNotes("");
                  }}
                  className="w-full bg-primary hover:bg-primary/90 text-white text-xs font-bold py-1 h-8 rounded-xl btn-premium"
                >
                  {t("finance.payment_btn_verify")}
                </Button>
              </Card>
            ))
          )}
        </CardContent>
      </Card>

      {/* Payment Verification Dialog */}
      <Dialog open={!!selectedPayment} onOpenChange={(open) => { if (!open) setSelectedPayment(null); }}>
        <DialogContent className="bg-popover backdrop-blur-md border-border shadow-sage-lg rounded-3xl p-6 w-full max-w-md sm:max-w-md overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">{t("finance.verify_title")}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">{t("finance.verify_desc")}</DialogDescription>
          </DialogHeader>
          {errorMsg && (
            <div className="p-3 bg-rose-50 text-[#8B3443] border border-rose-100 rounded-xl text-xs font-semibold animate-shake">
              {errorMsg}
            </div>
          )}
          {selectedPayment && (
            <div className="space-y-4 pt-2 font-sans">
              {(() => {
                const proofUrl = selectedPayment.proofFileUrl || (() => {
                  if (!selectedPayment.invoiceId) return null;
                  const otherPayment = paymentPageData.data.find(
                    (p: PaymentListItem) => p.invoiceId === selectedPayment.invoiceId && p.proofFileUrl
                  ) || initialPayments.find(
                    p => p.invoiceId === selectedPayment.invoiceId && p.proofFileUrl
                  );
                  return otherPayment?.proofFileUrl || null;
                })();
                return (
                  <div className="p-3.5 bg-gradient-to-br from-white to-[#F7F8F3] border border-border rounded-2xl space-y-1.5 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#8FAF9A]" />
                    <p className="text-xs text-muted-foreground">{t("finance.verify_lbl_payment_no")} <span className="font-mono font-bold text-foreground pl-1">{selectedPayment.paymentNumber}</span></p>
                    <p className="text-xs text-muted-foreground">{t("finance.verify_lbl_customer")} <span className="font-semibold text-foreground pl-1">{selectedPayment.customerName}</span></p>
                    <p className="text-xs text-muted-foreground">{t("finance.verify_lbl_amount")} <span className="font-mono font-extrabold text-sm text-primary pl-1">Rp {selectedPayment.amount.toLocaleString("id-ID")}</span></p>
                    {proofUrl && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 pt-1.5 border-t border-border/50">
                        {t("finance.verify_lbl_proof")}
                        <a
                          href={proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-[#3D563F] underline font-bold inline-flex items-center gap-1 ml-1"
                        >
                          <Eye className="h-3.5 w-3.5" /> {t("finance.view_proof")}
                        </a>
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider block">{t("finance.verify_lbl_deposit_account")}</label>
                <Select
                  value={verificationAccount}
                  onValueChange={(val) => setVerificationAccount(val || "")}
                  items={accounts.map(acc => ({ label: `${acc.name} (Saldo: Rp ${acc.openingBalance.toLocaleString()})`, value: acc.id }))}
                >
                  <SelectTrigger className="w-full max-w-full min-w-0 overflow-hidden bg-muted/30 border-border rounded-[12px] focus:ring-ring font-semibold text-xs h-10 text-foreground">
                    <SelectValue placeholder={t("finance.verify_lbl_deposit_account")}>
                      {verificationAccount ? (() => {
                        const acc = accounts.find(a => a.id === verificationAccount);
                        return acc ? (
                          <span className="block truncate text-left w-full max-w-[280px] sm:max-w-[320px]">
                            {acc.name} ({t("finance.balance_lbl")} Rp {acc.openingBalance.toLocaleString("id-ID")})
                          </span>
                        ) : undefined;
                      })() : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="border-border rounded-[12px]">
                    {accounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id} className="text-xs font-medium">{acc.name} ({t("finance.balance_lbl")} Rp {acc.openingBalance.toLocaleString()})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider block">{t("finance.verify_lbl_notes")}</label>
                <textarea
                  placeholder={t("finance.verify_notes_ph")}
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  className="flex min-h-[80px] w-full rounded-[12px] border border-border bg-muted/30/60 px-3 py-2 text-xs focus:border-[#4F6F52] focus-visible:outline-none focus:bg-card transition-all font-medium leading-normal resize-none text-foreground"
                />
              </div>

              <div className="bg-amber-50/80 border border-amber-200/50 rounded-2xl p-4 text-[11px] text-[#8A6D1D] leading-relaxed space-y-2">
                <p className="font-extrabold flex items-center gap-1.5 uppercase tracking-wider text-[10px] text-[#8A6D1D]">
                  âš ï¸ {t("finance.verify_warning_title")}
                </p>
                <ul className="list-disc list-inside space-y-1 font-semibold pl-1">
                  <li><strong>{t("finance.verify_btn_approve")}:</strong> {t("finance.verify_warning_approve")}</li>
                  <li><strong>{t("finance.verify_btn_reject")}:</strong> {t("finance.verify_warning_reject")}</li>
                </ul>
              </div>

              <div className="space-y-3 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => onVerifyPaymentSubmit(false)}
                    className="bg-card text-[#D77A7A] border border-rose-200 hover:bg-rose-50 font-bold text-xs h-10 rounded-[12px] btn-premium"
                    disabled={isSubmitting}
                  >
                    {t("finance.verify_btn_reject")}
                  </Button>
                  <Button
                    onClick={() => onVerifyPaymentSubmit(true)}
                    className="bg-primary hover:bg-primary/90 text-white font-bold text-xs h-10 rounded-[12px] btn-premium"
                    disabled={isSubmitting}
                  >
                    {t("finance.verify_btn_approve")}
                  </Button>
                </div>

                {isSuperAdmin && (
                  <Button
                    onClick={onDeletePaymentSubmit}
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-10 rounded-[12px] shadow-[0_4px_14px_rgba(220,38,38,0.25)] btn-premium"
                    disabled={isSubmitting}
                  >
                    {t("finance.verify_btn_delete")}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
