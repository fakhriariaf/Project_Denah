"use client";

import * as React from "react";
import { useI18n } from "@/lib/i18n";
import { InvoicePrintModal } from "@/components/invoice-print-modal";
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
  FileText,
  Eye,
  Trash2,
} from "lucide-react";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { createInvoice, deleteInvoice } from "@/server/actions/finance";
import type { PaginatedResult } from "@/lib/pagination";

type InvoiceListItem = {
  id: string;
  invoiceNumber: string;
  projectId: string;
  type: "booking_fee" | "dp" | "installment" | "other";
  amount: number;
  dueDate: Date | null;
  status: "unpaid" | "partial" | "paid" | "cancelled";
  createdAt: Date;
  projectName: string;
  customerName: string | null;
  unitCode: string | null;
};

interface InvoicesTabProps {
  projects: Array<{ id: string; name: string; code: string }>;
  units: Array<{ id: string; code: string; projectId: string; price: number }>;
  customers: Array<{ id: string; name: string; phone: string }>;
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
  selectedProjectId: string;
  searchQuery: string;
}

export function InvoicesTab({
  projects,
  units,
  customers,
  initialInvoices,
  initialPayments,
  selectedProjectId,
  searchQuery,
}: InvoicesTabProps) {
  const { t } = useI18n();

  // Internal state for dialogs/forms
  const [invoiceOpen, setInvoiceOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [printInvoice, setPrintInvoice] = React.useState<typeof initialInvoices[0] | null>(null);

  const [invoiceForm, setInvoiceForm] = React.useState({
    projectId: "",
    unitId: "",
    customerId: "",
    type: "booking_fee" as "booking_fee" | "dp" | "installment" | "other",
    amount: "",
    dueDate: "",
    notes: "",
  });

  // Set default project on mount
  React.useEffect(() => {
    if (projects.length > 0) {
      setInvoiceForm(f => ({ ...f, projectId: projects[0].id }));
    }
  }, [projects]);

  // Client-side paginated invoice state
  const INVOICE_PAGE_SIZE = 20;
  const invoicePageData: PaginatedResult<InvoiceListItem> = React.useMemo(() => {
    const filtered = initialInvoices.filter(inv => {
      const matchesProj = selectedProjectId === "all" || inv.projectId === selectedProjectId;
      const matchesQuery = searchQuery === "" ||
        inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.customerName && inv.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (inv.unitCode && inv.unitCode.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesProj && matchesQuery;
    });
    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / INVOICE_PAGE_SIZE));
    const data = filtered.slice(0, INVOICE_PAGE_SIZE);
    return { data, totalCount, page: 1, pageSize: INVOICE_PAGE_SIZE, totalPages };
  }, [initialInvoices, selectedProjectId, searchQuery]);

  // Pre-filter units for selected project
  const currentProjUnits = units.filter(u => u.projectId === invoiceForm.projectId);

  // Handlers
  const handleCreateInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await createInvoice({
        projectId: invoiceForm.projectId,
        unitId: invoiceForm.unitId || null,
        customerId: invoiceForm.customerId || null,
        type: invoiceForm.type,
        amount: Number(invoiceForm.amount),
        dueDate: invoiceForm.dueDate ? new Date(invoiceForm.dueDate) : null,
        notes: invoiceForm.notes || null,
      });
      if (res.success) {
        alert(t("finance.invoice_created"));
        setInvoiceForm(f => ({ ...f, amount: "", notes: "", dueDate: "" }));
        setInvoiceOpen(false);
        window.location.reload();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal membuat invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus invoice ini secara permanen dari sistem?")) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await deleteInvoice(invoiceId);
      if (res.success) {
        alert(t("finance.invoice_deleted"));
        window.location.reload();
      }
    } catch (err: any) {
      alert(err.message || "Gagal menghapus invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card className="bg-white border-[#D6DED2]">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg text-[#243028]">{t("finance.invoice_list_title")}</CardTitle>
            <CardDescription className="text-xs">{t("finance.invoice_list_desc")}</CardDescription>
          </div>

          <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
            <DialogTrigger nativeButton={true} render={
              <Button className="bg-[#8FAF9A] hover:bg-[#4F6F52] text-white flex items-center gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> {t("finance.invoice_btn_new")}
              </Button>
            } />
            <DialogContent className="bg-white">
              <DialogHeader>
                <DialogTitle>{t("finance.invoice_form_title")}</DialogTitle>
                <DialogDescription>{t("finance.invoice_form_desc")}</DialogDescription>
              </DialogHeader>
              {errorMsg && (
                <div className="p-3 bg-rose-50 text-danger border border-rose-100 rounded-md text-xs font-semibold">
                  {errorMsg}
                </div>
              )}
              <form onSubmit={handleCreateInvoiceSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#243028]">{t("finance.invoice_lbl_project")}</label>
                    <Select
                      value={invoiceForm.projectId}
                      onValueChange={(val) => setInvoiceForm(f => ({ ...f, projectId: val || "", unitId: "" }))}
                      items={projects.map(p => ({ label: p.name, value: p.id }))}
                    >
                      <SelectTrigger className="bg-white border-[#D6DED2] w-full">
                        <SelectValue placeholder={t("finance.invoice_lbl_project")}>
                          {invoiceForm.projectId ? projects.find(p => p.id === invoiceForm.projectId)?.name : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#243028]">{t("finance.invoice_lbl_unit")}</label>
                    <Select
                      value={invoiceForm.unitId}
                      onValueChange={(val) => setInvoiceForm(f => ({ ...f, unitId: val || "" }))}
                      items={currentProjUnits.map(u => ({ label: u.code, value: u.id }))}
                    >
                      <SelectTrigger className="bg-white border-[#D6DED2] w-full">
                        <SelectValue placeholder={t("finance.invoice_lbl_unit")}>
                          {invoiceForm.unitId ? units.find(u => u.id === invoiceForm.unitId)?.code : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {currentProjUnits.map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.code}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#243028]">{t("finance.invoice_lbl_customer")}</label>
                  <Select
                    value={invoiceForm.customerId}
                    onValueChange={(val) => setInvoiceForm(f => ({ ...f, customerId: val || "" }))}
                    items={customers.map(c => ({ label: `${c.name} (${c.phone})`, value: c.id }))}
                  >
                    <SelectTrigger className="bg-white border-[#D6DED2] w-full">
                      <SelectValue placeholder="Pilih Customer">
                        {invoiceForm.customerId ? (() => {
                          const c = customers.find(cust => cust.id === invoiceForm.customerId);
                          return c ? `${c.name} (${c.phone})` : undefined;
                        })() : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#243028]">{t("finance.invoice_lbl_type")}</label>
                    <Select
                      value={invoiceForm.type}
                      onValueChange={(val: any) => setInvoiceForm(f => ({ ...f, type: val }))}
                      items={[
                        { label: t("finance.invoice_type_bf"), value: "booking_fee" },
                        { label: t("finance.invoice_type_dp"), value: "dp" },
                        { label: t("finance.invoice_type_inst"), value: "installment" },
                        { label: t("finance.invoice_type_other"), value: "other" },
                      ]}
                    >
                      <SelectTrigger className="bg-white border-[#D6DED2] w-full">
                        <SelectValue placeholder={t("finance.invoice_lbl_type")}>
                          {invoiceForm.type === "booking_fee" && t("finance.invoice_type_bf")}
                          {invoiceForm.type === "dp" && t("finance.invoice_type_dp")}
                          {invoiceForm.type === "installment" && t("finance.invoice_type_inst")}
                          {invoiceForm.type === "other" && t("finance.invoice_type_other")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="booking_fee">{t("finance.invoice_type_bf")}</SelectItem>
                        <SelectItem value="dp">{t("finance.invoice_type_dp")}</SelectItem>
                        <SelectItem value="installment">{t("finance.invoice_type_inst")}</SelectItem>
                        <SelectItem value="other">{t("finance.invoice_type_other")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#243028]">{t("finance.invoice_lbl_amount")}</label>
                    <Input
                      type="number"
                      placeholder="Rp 0"
                      value={invoiceForm.amount}
                      onChange={(e) => setInvoiceForm(f => ({ ...f, amount: e.target.value }))}
                      className="bg-white border-[#D6DED2]"
                      required
                    />
                  </div>
                </div>

                {invoiceForm.amount && !isNaN(Number(invoiceForm.amount)) && (
                  <div className="p-2.5 bg-[#DDE8D8]/50 border border-[#8FAF9A]/30 rounded-xl space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                    <span className="text-[9px] font-bold text-[#66736A] uppercase tracking-wider block">{t("finance.invoice_format_rupiah")}</span>
                    <span className="font-mono font-extrabold text-sm text-[#4F6F52] tracking-tight tabular-nums">
                      Rp {Number(invoiceForm.amount).toLocaleString("id-ID")}
                    </span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#243028]">{t("finance.invoice_lbl_due")}</label>
                  <Input
                    type="date"
                    value={invoiceForm.dueDate}
                    onChange={(e) => setInvoiceForm(f => ({ ...f, dueDate: e.target.value }))}
                    className="bg-white border-[#D6DED2]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#243028]">{t("finance.invoice_lbl_notes")}</label>
                  <Input
                    placeholder={t("finance.invoice_lbl_notes_ph")}
                    value={invoiceForm.notes}
                    onChange={(e) => setInvoiceForm(f => ({ ...f, notes: e.target.value }))}
                    className="bg-white border-[#D6DED2]"
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="submit"
                    className="bg-[#4F6F52] hover:bg-[#8FAF9A] text-white w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? t("finance.saving") : t("finance.invoice_btn_submit")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("finance.col_invoice_no")}</TableHead>
                <TableHead>{t("finance.col_customer")}</TableHead>
                <TableHead>{t("finance.col_kavling")}</TableHead>
                <TableHead>{t("finance.col_type")}</TableHead>
                <TableHead className="text-right">{t("finance.col_amount")}</TableHead>
                <TableHead className="text-center">{t("finance.col_status")}</TableHead>
                <TableHead className="text-center">{t("finance.col_action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoicePageData.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-16 w-16 rounded-full bg-[#DDE8D8]/50 flex items-center justify-center mx-auto">
                        <FileText className="h-8 w-8 text-[#4F6F52]" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#243028] text-sm">{t("finance.invoice_empty")}</p>
                        <p className="text-xs text-[#66736A] mt-1">{t("finance.invoice_empty_desc")}</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                invoicePageData.data.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs font-semibold text-[#243028]">
                      {inv.invoiceNumber}
                    </TableCell>
                    <TableCell className="text-xs text-[#243028]">
                      {inv.customerName || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-[#66736A]">
                      {inv.unitCode || "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {inv.type === "dp" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FBE4C9] text-[#7A3D0E] border border-[#D47A2E]/30 text-[10px] font-bold uppercase tracking-wide">
                          🏗️ {t("finance.invoice_type_dp")}
                        </span>
                      ) : inv.type === "booking_fee" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFF0A0] text-[#6B4F00] border border-[#D4A017]/30 text-[10px] font-bold uppercase tracking-wide">
                          {t("finance.invoice_type_bf")}
                        </span>
                      ) : inv.type === "installment" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#C7E8F7] text-[#0E3F57] border border-[#2196C4]/30 text-[10px] font-bold uppercase tracking-wide">
                          {t("finance.invoice_type_inst")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#E7E9E7] text-[#3D4840] text-[10px] font-semibold uppercase tracking-wide">
                          {inv.type.replace("_", " ")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-[#243028] tabular-nums text-xs">
                      Rp {inv.amount.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <Badge
                          className={
                            inv.status === "paid"
                              ? "bg-[#DCECF7] text-[#33627A]"
                              : inv.status === "partial"
                              ? "bg-[#FBE4C9] text-[#9A5C21]"
                              : "bg-[#F3D1D1] text-[#8A3030]"
                          }
                        >
                          {inv.status === "paid"
                            ? t("finance.status_paid")
                            : inv.status === "partial"
                            ? t("finance.status_partial")
                            : t("finance.status_unpaid")}
                        </Badge>
                        {(() => {
                          const matchingPayment = initialPayments.find(p => p.invoiceId === inv.id && p.proofFileUrl);
                          if (matchingPayment?.proofFileUrl) {
                            return (
                              <a
                                href={matchingPayment.proofFileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-[#4F6F52] hover:text-[#3D563F] underline font-bold inline-flex items-center gap-1 mt-0.5"
                              >
                                <Eye className="h-3 w-3" /> {t("finance.view_proof")}
                              </a>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            const fullInvoice = initialInvoices.find(i => i.id === inv.id);
                            if (fullInvoice) setPrintInvoice(fullInvoice);
                          }}
                          title={t("finance.btn_print")}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#DDE8D8] hover:bg-[#4F6F52] text-[#4F6F52] hover:text-white text-[11px] font-semibold transition-all duration-200 hover:scale-105 border border-[#8FAF9A]/30"
                        >
                          🖨️ {t("finance.btn_print")}
                        </button>
                        <button
                          onClick={() => handleDeleteInvoice(inv.id)}
                          title="Hapus Invoice"
                          disabled={isSubmitting}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-[#D77A7A] text-[#D77A7A] hover:text-white text-[11px] font-semibold transition-all duration-200 hover:scale-105 border border-rose-200 disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" />
                          Hapus
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <DataTablePagination
            totalItems={invoicePageData.totalCount}
            itemsPerPage={invoicePageData.pageSize}
          />
        </CardContent>
      </Card>

      {/* Invoice Print Modal */}
      {printInvoice && (
        <InvoicePrintModal
          invoice={printInvoice}
          payments={initialPayments.map(p => ({
            id: p.id,
            invoiceId: p.invoiceId ?? null,
            paymentNumber: p.paymentNumber,
            amount: p.amount,
            paymentDate: p.paymentDate,
            paymentMethod: p.paymentMethod,
            proofFileUrl: p.proofFileUrl ?? null,
            status: p.status,
            verifiedAt: p.verifiedAt,
          }))}
          onClose={() => setPrintInvoice(null)}
        />
      )}
    </>
  );
}
