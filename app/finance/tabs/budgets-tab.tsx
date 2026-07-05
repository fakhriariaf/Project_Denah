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
import { Plus, FolderOpen } from "lucide-react";

interface BudgetsTabProps {
  projects: Array<{ id: string; name: string; code: string }>;
  categories: Array<{
    id: string;
    name: string;
    type: "income" | "expense";
    status: "active" | "inactive";
  }>;
  filteredBudgets: Array<{
    id: string;
    projectId: string;
    name: string;
    periodStart: Date;
    periodEnd: Date;
    totalAmount: number;
    status: "draft" | "active" | "closed";
    projectName: string;
  }>;
  budgetForm: {
    projectId: string;
    name: string;
    periodStart: string;
    periodEnd: string;
    totalAmount: string;
    categoryId: string;
    allocatedAmount: string;
  };
  setBudgetForm: React.Dispatch<React.SetStateAction<{
    projectId: string;
    name: string;
    periodStart: string;
    periodEnd: string;
    totalAmount: string;
    categoryId: string;
    allocatedAmount: string;
  }>>;
  budgetOpen: boolean;
  setBudgetOpen: (open: boolean) => void;
  errorMsg: string | null;
  isSubmitting: boolean;
  onCreateBudgetSubmit: (e: React.FormEvent) => Promise<void>;
}

export function BudgetsTab({
  projects,
  categories,
  filteredBudgets,
  budgetForm,
  setBudgetForm,
  budgetOpen,
  setBudgetOpen,
  errorMsg,
  isSubmitting,
  onCreateBudgetSubmit,
}: BudgetsTabProps) {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card className="bg-white border-[#D6DED2]">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg text-[#243028]">{t("finance.budget_list_title")}</CardTitle>
              <CardDescription className="text-xs">{t("finance.budget_list_desc")}</CardDescription>
            </div>
            <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
              <DialogTrigger nativeButton={true} render={
                <Button className="bg-[#8FAF9A] hover:bg-[#4F6F52] text-white flex items-center gap-1.5 text-xs">
                  <Plus className="h-3.5 w-3.5" /> {t("finance.budget_btn_new")}
                </Button>
              } />
              <DialogContent className="bg-white">
                <DialogHeader>
                  <DialogTitle>{t("finance.budget_form_title")}</DialogTitle>
                  <DialogDescription>{t("finance.budget_form_desc")}</DialogDescription>
                </DialogHeader>
                {errorMsg && (
                  <div className="p-3 bg-rose-50 text-danger border border-rose-100 rounded-md text-xs font-semibold">
                    {errorMsg}
                  </div>
                )}
                <form onSubmit={onCreateBudgetSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#243028]">{t("finance.budget_lbl_project")}</label>
                    <Select
                      value={budgetForm.projectId}
                      onValueChange={(val) => setBudgetForm(f => ({ ...f, projectId: val || "" }))}
                      items={projects.map(p => ({ label: p.name, value: p.id }))}
                    >
                      <SelectTrigger className="bg-white border-[#D6DED2]">
                        <SelectValue placeholder="Pilih Perumahan">
                          {budgetForm.projectId ? projects.find(p => p.id === budgetForm.projectId)?.name : undefined}
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
                    <label className="text-xs font-semibold text-[#243028]">{t("finance.budget_lbl_name")}</label>
                    <Input
                      placeholder={t("finance.budget_lbl_name_ph")}
                      value={budgetForm.name}
                      onChange={(e) => setBudgetForm(f => ({ ...f, name: e.target.value }))}
                      className="bg-white border-[#D6DED2]"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#243028]">{t("finance.budget_lbl_start")}</label>
                      <Input
                        type="date"
                        value={budgetForm.periodStart}
                        onChange={(e) => setBudgetForm(f => ({ ...f, periodStart: e.target.value }))}
                        className="bg-white border-[#D6DED2]"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#243028]">{t("finance.budget_lbl_end")}</label>
                      <Input
                        type="date"
                        value={budgetForm.periodEnd}
                        onChange={(e) => setBudgetForm(f => ({ ...f, periodEnd: e.target.value }))}
                        className="bg-white border-[#D6DED2]"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#243028]">{t("finance.budget_lbl_category")}</label>
                      <Select
                        value={budgetForm.categoryId}
                        onValueChange={(val) => setBudgetForm(f => ({ ...f, categoryId: val || "" }))}
                        items={categories.filter(c => c.type === "expense").map(c => ({ label: c.name, value: c.id }))}
                      >
                        <SelectTrigger className="bg-white border-[#D6DED2]">
                          <SelectValue placeholder="Pilih Kategori">
                            {budgetForm.categoryId ? categories.find(c => c.id === budgetForm.categoryId)?.name : undefined}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {categories.filter(c => c.type === "expense").map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#243028]">{t("finance.budget_lbl_alloc")}</label>
                      <Input
                        type="number"
                        placeholder="Rp 0"
                        value={budgetForm.allocatedAmount}
                        onChange={(e) => setBudgetForm(f => ({ ...f, allocatedAmount: e.target.value }))}
                        className="bg-white border-[#D6DED2]"
                        required
                      />
                    </div>
                  </div>

                  {budgetForm.allocatedAmount && !isNaN(Number(budgetForm.allocatedAmount)) && (
                    <div className="p-2.5 bg-[#DDE8D8]/50 border border-[#8FAF9A]/30 rounded-xl space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                      <span className="text-[9px] font-bold text-[#66736A] uppercase tracking-wider block">Format Rupiah Terbaca</span>
                      <span className="font-mono font-extrabold text-sm text-[#4F6F52] tracking-tight tabular-nums">
                        Rp {Number(budgetForm.allocatedAmount).toLocaleString("id-ID")}
                      </span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#243028]">{t("finance.budget_lbl_total")}</label>
                    <Input
                      type="number"
                      placeholder="Rp 0"
                      value={budgetForm.totalAmount}
                      onChange={(e) => setBudgetForm(f => ({ ...f, totalAmount: e.target.value }))}
                      className="bg-white border-[#D6DED2]"
                      required
                    />
                  </div>

                  {budgetForm.totalAmount && !isNaN(Number(budgetForm.totalAmount)) && (
                    <div className="p-2.5 bg-[#DDE8D8]/50 border border-[#8FAF9A]/30 rounded-xl space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                      <span className="text-[9px] font-bold text-[#66736A] uppercase tracking-wider block">Format Rupiah Terbaca</span>
                      <span className="font-mono font-extrabold text-sm text-[#4F6F52] tracking-tight tabular-nums">
                        Rp {Number(budgetForm.totalAmount).toLocaleString("id-ID")}
                      </span>
                    </div>
                  )}

                  <DialogFooter>
                    <Button
                      type="submit"
                      className="bg-[#4F6F52] hover:bg-[#8FAF9A] text-white w-full"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? t("finance.saving") : t("finance.budget_btn_submit")}
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
                  <TableHead>{t("finance.col_budget_name")}</TableHead>
                  <TableHead>{t("finance.col_budget_proj")}</TableHead>
                  <TableHead>{t("finance.col_budget_period")}</TableHead>
                  <TableHead className="text-right">{t("finance.col_budget_total")}</TableHead>
                  <TableHead className="text-center">{t("finance.col_status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBudgets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-16 w-16 rounded-full bg-[#DDE8D8]/50 flex items-center justify-center mx-auto">
                          <FolderOpen className="h-8 w-8 text-[#4F6F52]" />
                        </div>
                        <div>
                          <p className="font-semibold text-[#243028] text-sm">{t("finance.budget_empty")}</p>
                          <p className="text-xs text-[#66736A] mt-1">{t("finance.budget_empty_desc")}</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBudgets.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="text-xs font-semibold text-[#243028]">
                        {b.name}
                      </TableCell>
                      <TableCell className="text-xs text-[#66736A]">
                        {b.projectName}
                      </TableCell>
                      <TableCell className="text-xs text-[#66736A]">
                        {new Date(b.periodStart).toLocaleDateString("id-ID")} - {new Date(b.periodEnd).toLocaleDateString("id-ID")}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold tabular-nums text-xs text-[#243028]">
                        Rp {b.totalAmount.toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-[#DDE8D8] text-[#4F6F52]">{t("finance.badge_active")}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Visual budgets monitoring cards */}
      <div className="space-y-6">
        <Card className="bg-white/70 backdrop-blur-md border border-[#D6DED2]/80 shadow-sage hover:shadow-sage-lg transition-premium rounded-3xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-[#243028]">{t("finance.absorption_title")}</CardTitle>
            <CardDescription className="text-xs text-[#66736A] font-medium">{t("finance.absorption_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4 font-sans">
            {[
              { name: "Operational & Kantor", value: 40 },
              { name: "Fisik Konstruksi / Upah Tukang", value: 15 },
              { name: "Biaya Perizinan / Legal Sertifikat", value: 70 },
              { name: "Pemasaran, Brosur & Iklan", value: 88 },
            ].map((item, idx) => {
              const colorClass = item.value < 50 ? "bg-[#8FAF9A]" : item.value < 80 ? "bg-[#E9C46A]" : "bg-[#D77A7A]";
              const textClass = item.value < 50 ? "text-[#4F6F52]" : item.value < 80 ? "text-[#9A7D21]" : "text-[#D77A7A]";
              const bgClass = item.value < 50 ? "bg-[#DDE8D8]/30" : item.value < 80 ? "bg-amber-50" : "bg-rose-50";

              return (
                <div key={idx} className="space-y-2 group">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-[#243028] group-hover:text-[#4F6F52] transition-colors">{item.name}</span>
                    <span className={`font-mono font-extrabold tabular-nums px-2 py-0.5 rounded-md ${bgClass} ${textClass}`}>
                      {item.value}%
                    </span>
                  </div>
                  <div className="w-full bg-[#F7F8F3] border border-[#D6DED2] rounded-full h-2.5 overflow-hidden p-0.5 shadow-inner">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${colorClass}`}
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
