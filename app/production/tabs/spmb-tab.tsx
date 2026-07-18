"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Truck, AlertTriangle } from "lucide-react";
import {
  createMaterialRequest, submitMaterialRequest, markMaterialRequestPurchased,
} from "@/server/actions/production";

interface MaterialRequest {
  id: string;
  requestNumber: string;
  spkId: string | null;
  projectId: string | null;
  unitId: string | null;
  vendorId: string | null;
  description: string;
  estimatedAmount: number;
  status: "draft" | "submitted" | "finance_pending" | "approved" | "rejected" | "purchased";
  transactionId: string | null;
  createdAt: Date;
  spkNumber: string;
  projectName: string;
  unitCode: string;
  vendorName: string | null;
}

interface Spk {
  id: string;
  spkNumber: string;
  projectId: string | null;
  unitId: string | null;
  vendorId: string | null;
  title: string;
  rabAmount: number;
  status: "draft" | "active" | "completed" | "overdue" | "cancelled" | "proses_konstruksi" | "selesai_konstruksi";
  unitCode: string;
  projectName: string;
}

export interface SpmbTabProps {
  materialRequests: MaterialRequest[];
  spks: Spk[];
}

export function SpmbTab({ materialRequests, spks }: SpmbTabProps) {
  const router = useRouter();
  const { t } = useI18n();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [materialOpen, setMaterialOpen] = React.useState(false);
  const [materialStep, setMaterialStep] = React.useState(1);
  const [materialNecessity, setMaterialNecessity] = React.useState(50);

  const [newMaterial, setNewMaterial] = React.useState({
    spkId: "", projectId: "", unitId: "", vendorId: "", description: "", estimatedAmount: "",
  });

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true); setErrorMessage(null);
    try {
      const selectedSpk = spks.find(s => s.id === newMaterial.spkId);
      if (!selectedSpk) throw new Error("SPK tidak ditemukan");
      await createMaterialRequest({
        spkId: newMaterial.spkId, projectId: selectedSpk.projectId, unitId: selectedSpk.unitId,
        vendorId: selectedSpk.vendorId || null, description: newMaterial.description, estimatedAmount: Number(newMaterial.estimatedAmount),
      });
      setSuccessMessage(t("production.material_submitted"));
      setMaterialOpen(false);
      setNewMaterial({ spkId: "", projectId: "", unitId: "", vendorId: "", description: "", estimatedAmount: "" });
      router.refresh();
    } catch (e: any) { setErrorMessage(e.message || "Gagal mengajukan material."); }
    finally { setIsSubmitting(false); }
  };

  const handleSubmitMaterialToFinance = async (requestId: string) => {
    setIsSubmitting(true); setErrorMessage(null); setSuccessMessage(null);
    try {
      await submitMaterialRequest(requestId);
      setSuccessMessage(t("production.material_forwarded"));
      router.refresh();
    } catch (e: any) { setErrorMessage(e.message || "Gagal meneruskan request ke keuangan."); }
    finally { setIsSubmitting(false); }
  };

  const handleMarkMaterialPurchased = async (requestId: string) => {
    setIsSubmitting(true); setErrorMessage(null); setSuccessMessage(null);
    try {
      await markMaterialRequestPurchased(requestId);
      setSuccessMessage(t("production.material_purchased_ok"));
      router.refresh();
    } catch (e: any) { setErrorMessage(e.message || "Gagal menandai material dibeli."); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="space-y-6">
      {errorMessage && <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium"><AlertTriangle className="h-5 w-5 shrink-0" /><span>{errorMessage}</span></div>}
      {successMessage && <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary border border-primary/40 text-primary text-sm font-medium"><span>✓ {successMessage}</span></div>}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-foreground">{t("production.materials_title")}</h3>
          <p className="text-xs text-muted-foreground">{t("production.materials_desc")}</p>
        </div>
        <Button onClick={() => { setMaterialOpen(true); setMaterialStep(1); setMaterialNecessity(50); }} className="btn-premium bg-[#4F6F52] hover:bg-[#3D563F] text-white font-semibold text-xs">
          <Plus className="mr-1.5 h-3.5 w-3.5" />{t("production.btn_new_material")}
        </Button>
      </div>

      {/* Material Requests Table */}
      <div className="rounded-md border border-primary/20 overflow-hidden">
        <Table>
          <TableHeader className="bg-[#8FAF9A]/10">
            <TableRow>
              <TableHead className="font-semibold text-primary">{t("production.col_req_no")}</TableHead>
              <TableHead className="font-semibold text-primary">{t("production.col_spk_linked")}</TableHead>
              <TableHead className="font-semibold text-primary">{t("production.col_material_desc")}</TableHead>
              <TableHead className="font-semibold text-primary">{t("production.col_kavling")}</TableHead>
              <TableHead className="font-semibold text-primary">{t("production.col_est_cost")}</TableHead>
              <TableHead className="font-semibold text-primary">{t("production.col_req_date")}</TableHead>
              <TableHead className="font-semibold text-primary">{t("production.col_finance_status")}</TableHead>
              <TableHead className="font-semibold text-primary text-right">{t("production.col_action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {materialRequests.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="py-12 text-center"><div className="flex flex-col items-center gap-3"><div className="h-16 w-16 rounded-full bg-secondary/50 flex items-center justify-center mx-auto"><Plus className="h-8 w-8 text-primary" /></div><div><p className="font-semibold text-foreground text-sm">{t("production.material_empty")}</p><p className="text-xs text-muted-foreground mt-1">{t("production.material_empty_desc")}</p></div></div></TableCell></TableRow>
            ) : (
              materialRequests.map((m) => (
                <TableRow key={m.id} className="hover:bg-[#8FAF9A]/5 transition-colors duration-150">
                  <TableCell className="font-bold tabular-nums text-foreground">{m.requestNumber}</TableCell>
                  <TableCell className="font-semibold text-foreground">{m.spkNumber}</TableCell>
                  <TableCell className="font-medium text-foreground max-w-[200px] truncate">{m.description}</TableCell>
                  <TableCell className="font-semibold text-foreground">{m.unitCode}</TableCell>
                  <TableCell className="font-bold text-foreground tabular-nums">Rp {m.estimatedAmount.toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{new Date(m.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge className={`shadow-none font-semibold text-xs ${m.status === "purchased" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : m.status === "approved" ? "bg-secondary text-primary border border-primary/30" : m.status === "finance_pending" ? "bg-amber-50 text-amber-700 border border-amber-200" : m.status === "submitted" ? "bg-blue-50 text-blue-700 border border-blue-200" : m.status === "rejected" ? "bg-red-50 text-red-700 border border-red-200" : "bg-gray-100 text-gray-700 border border-gray-200"}`}>
                      {m.status === "purchased" ? t("production.mat_status_purchased") : m.status === "approved" ? t("production.mat_status_approved") : m.status === "finance_pending" ? t("production.mat_status_pending") : m.status === "submitted" ? t("production.mat_status_submitted") : m.status === "rejected" ? t("production.mat_status_rejected") : t("production.status_draft")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {m.status === "draft" && <Button size="sm" onClick={() => handleSubmitMaterialToFinance(m.id)} className="bg-primary hover:bg-primary text-primary-foreground font-semibold text-xs h-8">{t("production.btn_submit_to_finance")}</Button>}
                    {m.status === "approved" && <Button size="sm" onClick={() => handleMarkMaterialPurchased(m.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8">{t("production.btn_mark_purchased")}</Button>}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Material Request Dialog */}
      <Dialog open={materialOpen} onOpenChange={(open) => { setMaterialOpen(open); if (!open) { setMaterialStep(1); setMaterialNecessity(50); } }}>
        <DialogContent className="sm:max-w-lg rounded-3xl bg-white/98 backdrop-blur-md border border-border shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
          <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-border">
            <DialogHeader>
              <DialogTitle className="text-primary font-bold text-lg flex items-center gap-2"><Truck className="h-5 w-5" />{t("production.material_form_title")}</DialogTitle>
              <DialogDescription className="text-xs">{t("production.material_form_desc")}</DialogDescription>
            </DialogHeader>
          </div>
          <form onSubmit={handleCreateMaterial} className="p-6 space-y-4 pt-4 max-h-[75vh] overflow-y-auto">
            {/* Step indicator */}
            <div className="flex items-center justify-between px-1 pb-3 border-b border-primary/20 mb-3">
              <div className="flex items-center gap-1.5"><span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${materialStep >= 1 ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>1</span><span className="text-[11px] font-semibold text-foreground">SPK</span></div>
              <div className="h-px bg-[#8FAF9A]/25 flex-1 mx-2" />
              <div className="flex items-center gap-1.5"><span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${materialStep >= 2 ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>2</span><span className="text-[11px] font-semibold text-foreground">Detail</span></div>
              <div className="h-px bg-[#8FAF9A]/25 flex-1 mx-2" />
              <div className="flex items-center gap-1.5"><span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${materialStep >= 3 ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>3</span><span className="text-[11px] font-semibold text-foreground">Biaya</span></div>
            </div>

            {/* Step 1 */}
            {materialStep === 1 && (
              <div className="space-y-4 py-2">
                <div className="space-y-1"><label className="font-semibold text-foreground text-xs">{t("production.material_lbl_spk")}</label>
                  <Select value={newMaterial.spkId} onValueChange={(val: string | null) => setNewMaterial(prev => ({ ...prev, spkId: val || "" }))} required items={spks.map(s => ({ label: `${s.spkNumber} — ${s.title} (${s.unitCode})`, value: s.id }))}>
                    <SelectTrigger className="border-primary/30 focus:ring-primary rounded-xl"><SelectValue placeholder={t("production.material_lbl_spk")}>{newMaterial.spkId ? (() => { const s = spks.find(spk => spk.id === newMaterial.spkId); return s ? `${s.spkNumber} — ${s.title} (${s.unitCode})` : undefined; })() : undefined}</SelectValue></SelectTrigger>
                    <SelectContent>{spks.filter(s => s.status === "active" || s.status === "proses_konstruksi" || s.status === "overdue" || s.id === newMaterial.spkId).map(s => <SelectItem key={s.id} value={s.id}>{s.spkNumber} &mdash; {s.title} ({s.unitCode})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {newMaterial.spkId && (() => { const selSpk = spks.find(s => s.id === newMaterial.spkId); if (!selSpk) return null; return <div className="p-3.5 bg-[#8FAF9A]/5 border border-primary/20 rounded-2xl space-y-2 text-xs animate-scale-in"><span className="text-[10px] font-bold text-primary uppercase tracking-wider">Detail SPK</span><div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1 font-semibold text-foreground"><div className="space-y-0.5"><span className="text-[10px] text-muted-foreground font-medium">{t("production.info_project")}</span><div>{selSpk.projectName}</div></div><div className="space-y-0.5"><span className="text-[10px] text-muted-foreground font-medium">{t("production.info_kavling")}</span><div className="font-mono text-primary font-bold">{selSpk.unitCode}</div></div></div></div>; })()}
                <div className="flex justify-end pt-2"><Button type="button" disabled={!newMaterial.spkId} onClick={() => setMaterialStep(2)} className="bg-primary hover:bg-primary text-white font-semibold text-xs rounded-xl shadow-sm h-9 px-4">{t("production.btn_next")}</Button></div>
              </div>
            )}

            {/* Step 2 */}
            {materialStep === 2 && (
              <div className="space-y-4 py-2">
                <div className="space-y-1"><label className="font-semibold text-foreground text-xs">{t("production.material_lbl_desc")}</label><Textarea required placeholder={t("production.material_desc_ph")} className="border-primary/30 focus-visible:ring-primary text-xs rounded-xl" value={newMaterial.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewMaterial(prev => ({ ...prev, description: e.target.value }))} /></div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-foreground"><span>{t("production.material_lbl_urgency")}</span><span className={`font-extrabold text-[10px] px-2 py-0.5 rounded-full ${materialNecessity <= 35 ? "bg-secondary text-primary" : materialNecessity <= 75 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700 animate-pulse"}`}>{materialNecessity <= 35 ? t("production.urgency_low") : materialNecessity <= 75 ? t("production.urgency_medium") : t("production.urgency_critical")}</span></div>
                  <Slider min={1} max={100} step={5} value={[materialNecessity]} onValueChange={(val: number[]) => setMaterialNecessity(val[0])} className="py-2" />
                  <div className="h-3 bg-muted rounded-full overflow-hidden border border-border flex"><div className={`h-full transition-all duration-300 ${materialNecessity <= 35 ? "bg-[#8FAF9A]" : materialNecessity <= 75 ? "bg-[#E9C46A]" : "bg-[#D77A7A]"}`} style={{ width: `${materialNecessity}%` }} /></div>
                  <div className="flex justify-between text-[9px] text-muted-foreground font-semibold"><span>{t("production.stock_safe")}</span><span>{t("production.stock_low")}</span><span>{t("production.stock_critical")}</span></div>
                </div>
                <div className="flex justify-between pt-2">
                  <Button type="button" variant="ghost" onClick={() => setMaterialStep(1)} className="text-xs text-muted-foreground hover:text-foreground h-9">{t("production.btn_back")}</Button>
                  <Button type="button" disabled={!newMaterial.description.trim()} onClick={() => setMaterialStep(3)} className="bg-primary hover:bg-primary text-white font-semibold text-xs rounded-xl shadow-sm h-9 px-4">{t("production.btn_next")}</Button>
                </div>
              </div>
            )}

            {/* Step 3 */}
            {materialStep === 3 && (
              <div className="space-y-4 py-2">
                <div className="space-y-1"><label className="font-semibold text-foreground text-xs">{t("production.material_lbl_cost")}</label>
                  <div className="relative"><span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-semibold">Rp</span><Input type="number" required placeholder={t("production.material_cost_ph")} className="pl-8 border-primary/30 focus-visible:ring-primary rounded-xl font-mono text-sm font-semibold" value={newMaterial.estimatedAmount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMaterial(prev => ({ ...prev, estimatedAmount: e.target.value }))} /></div>
                </div>
                {Number(newMaterial.estimatedAmount) > 0 && (() => { const selSpk = spks.find(s => s.id === newMaterial.spkId); return <div className="p-3.5 bg-secondary/20 border border-primary/20 rounded-2xl space-y-2 text-xs animate-scale-in"><span className="text-[10px] font-bold text-primary uppercase tracking-wider">Konfirmasi</span><div className="space-y-1.5 font-semibold text-foreground"><div className="flex justify-between"><span className="text-muted-foreground font-medium">{t("production.material_est_cost_lbl")}</span><span className="font-mono text-sm font-bold text-primary tabular-nums">Rp {Number(newMaterial.estimatedAmount).toLocaleString()}</span></div>{selSpk && <div className="flex justify-between border-t border-primary/50/10 pt-1 text-[10px]"><span className="text-muted-foreground font-medium">{t("production.material_spk_ceiling")}:</span><span className="font-mono text-foreground font-bold tabular-nums">Rp {selSpk.rabAmount.toLocaleString()}</span></div>}</div></div>; })()}
                <div className="flex justify-between pt-2">
                  <Button type="button" variant="ghost" onClick={() => setMaterialStep(2)} className="text-xs text-muted-foreground hover:text-foreground h-9">{t("production.btn_back")}</Button>
                  <Button type="submit" disabled={isSubmitting || !newMaterial.estimatedAmount} className="bg-primary hover:bg-primary text-primary-foreground font-semibold text-xs rounded-xl shadow-sm h-9 px-4">{t("production.btn_submit_material")}</Button>
                </div>
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
