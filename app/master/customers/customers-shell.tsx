"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CustomerForm } from "./customer-form";
import { DeleteConfirm } from "@/components/delete-confirm";
import { deleteCustomer } from "@/server/actions/master";
import { User, Phone, Mail, MapPin, Search, Layers, Clipboard, ShieldCheck, HelpCircle, Check, Info } from "lucide-react";
import type { CustomerInput } from "@/server/validators/master";
import { useI18n } from "@/lib/i18n";

interface Customer {
  id: string;
  name: string;
  nik: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  source: string;
  status: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  unitCode?: string | null;
  paymentScheme?: string | null;
  originalStatus?: string | null;
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  prospect:          { label: "Prospek",     className: "bg-[#DCECF7] text-[#33627A] border-[#33627A]/20" },
  booking:           { label: "Booking",     className: "bg-[#FFF2C2] text-[#8A6D1D] border-[#8A6D1D]/20" },
  kpr_process:       { label: "Proses KPR",  className: "bg-[#DCECF7] text-[#33627A] border-[#33627A]/20" },
  akad:              { label: "Akad",        className: "bg-secondary text-primary border-[#4F6F52]/20" },
  buyer:             { label: "Pembeli",     className: "bg-[#D4EEE7] text-[#3F7568] border-[#3F7568]/20" },
  under_constructor: { label: "Pembangunan", className: "bg-[#E9DDF7] text-[#5D4382] border-[#5D4382]/20" },
  cancelled:         { label: "Batal",       className: "bg-[#E7E9E7] text-[#5F6861] border-[#5F6861]/20" },
};

export function CustomersShell({
  initialCustomers,
  isEditor,
  canDelete = false,
}: {
  initialCustomers: Customer[];
  isEditor: boolean;
  canDelete?: boolean;
}) {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();

  const getDynamicStatusLabel = (c: Customer) => {
    const isKpr = c.paymentScheme === "kpr";
    if (c.status === "under_constructor") {
      return isKpr ? "Pembeli KPR - Unit Sedang Pembangunan" : "Pembeli - Unit Sedang Pembangunan";
    }
    if (c.status === "buyer") {
      return isKpr ? "Pembeli KPR - Sukses" : "Pembeli - Sukses";
    }
    if (c.status === "akad") {
      return isKpr ? "Pembeli KPR - Proses Akad" : "Pembeli - Akad";
    }
    if (c.status === "kpr_process") {
      return "Proses KPR";
    }
    if (c.status === "booking") {
      return "Booking";
    }
    return STATUS_MAP[c.status]?.label || c.status;
  };

  const filteredCustomers = initialCustomers.filter((c) => {
    const matchQ =
      !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      (c.email ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus =
      !statusFilter ||
      c.status === statusFilter ||
      (statusFilter === "buyer" && c.status === "under_constructor");
    return matchQ && matchStatus;
  });

  const selectedCustomer = initialCustomers.find((c) => c.id === selectedCustomerId);

  const formatNIK = (nik: string | null) => {
    if (!nik) return "-";
    const cleaned = nik.replace(/\s+/g, "");
    const parts = [];
    for (let i = 0; i < cleaned.length; i += 4) {
      parts.push(cleaned.substring(i, i + 4));
    }
    return parts.join(" ");
  };

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── PREMIUM HEADER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-border shadow-sage p-6">
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 h-20 w-20 rounded-full bg-primary/8 blur-xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-foreground tracking-tight">{t("cust.title")}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{t("cust.subtitle")}</p>
            </div>
          </div>
          {isEditor && (
            <div className="shrink-0 animate-in fade-in zoom-in-95 duration-200 self-end md:self-center">
              <CustomerForm />
            </div>
          )}
        </div>
      </div>

      {/* Split Deck Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
        {/* Left Pane (Table) */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border/80 shadow-sage bg-card rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/30">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold">{t("cust.list_title")}</CardTitle>
                  <CardDescription className="text-xs">
                    {t("cust.list_desc")}
                  </CardDescription>
                </div>
                {/* Search & Status Filters */}
                <div className="flex flex-wrap gap-2 items-center">
                  <Input
                    placeholder={t("cust.search_placeholder")}
                    className="h-8 max-w-[180px] text-xs bg-muted/30/50 border-border rounded-xl focus:bg-card transition-premium"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-1 bg-muted/30 p-1 rounded-xl border border-border/50">
                    <button
                      onClick={() => setStatusFilter("")}
                      className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-premium cursor-pointer ${
                        statusFilter === "" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:bg-background/60"
                      }`}
                    >
                      {t("cust.all")}
                    </button>
                    {Object.keys(STATUS_MAP).map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-premium cursor-pointer ${
                          statusFilter === s ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:bg-background/60"
                        }`}
                      >
                        {STATUS_MAP[s]?.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {filteredCustomers.length === 0 ? (
                <div className="py-16 text-center flex flex-col items-center justify-center">
                  <div className="h-16 w-16 rounded-full bg-secondary/60 flex items-center justify-center mb-3">
                    <User className="h-8 w-8 text-primary" />
                  </div>
                  <p className="font-bold text-foreground text-sm">{t("cust.not_found")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("cust.not_found_desc")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow className="border-b border-border/40 hover:bg-transparent">
                        <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[11px] py-4 pl-6">{t("cust.col_name")}</TableHead>
                        <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[11px] py-4">{t("cust.col_phone")}</TableHead>
                        <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[11px] py-4">Unit/Kavling</TableHead>
                        <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[11px] py-4">{t("cust.col_source")}</TableHead>
                        <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[11px] py-4">{t("cust.col_status")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCustomers.map((c) => {
                        const st = STATUS_MAP[c.status];
                        return (
                          <TableRow
                            key={c.id}
                            className={`cursor-pointer border-b border-border/40 transition-premium pl-6 ${
                              selectedCustomerId === c.id
                                ? "bg-secondary/50 hover:bg-secondary/70 border-l-4 border-l-[#4F6F52] font-semibold"
                                : "hover:bg-muted/30/40"
                            }`}
                            onClick={() => setSelectedCustomerId(c.id)}
                          >
                            <TableCell className="text-sm font-semibold text-foreground py-4 pl-6">{c.name}</TableCell>
                            <TableCell className="font-mono text-xs text-primary py-4">{c.phone}</TableCell>
                            <TableCell className="text-xs font-bold text-amber-700 py-4 font-mono">{c.unitCode || "-"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground py-4 capitalize">
                              {c.source ? c.source.replace("_", " ") : "-"}
                            </TableCell>
                            <TableCell className="py-4">
                              <Badge variant="outline" className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${st?.className}`}>
                                {getDynamicStatusLabel(c)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Pane (Interactive Specification Board): 35% width */}
        <div className="lg:col-span-1 lg:sticky lg:top-[84px] transition-premium">
          {selectedCustomer ? (
            <Card className="border-border shadow-sage-lg bg-card rounded-3xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
              {/* Branding Section with Initial Avatar */}
              <div className="bg-primary text-white p-6 relative overflow-hidden flex items-center gap-4">
                <div className="absolute top-[-30%] right-[-10%] w-[50%] h-[150%] rounded-full bg-card/5 blur-xl pointer-events-none" />
                <div className="w-14 h-14 rounded-2xl bg-card/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-xl font-black text-white shrink-0 shadow-inner">
                  {selectedCustomer.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="space-y-1 relative z-10 flex-1 min-w-0">
                  <span className="text-[9px] font-bold tracking-wider uppercase bg-card/10 backdrop-blur-md px-2 py-0.5 rounded border border-white/10">
                    {t("cust.sheet_title")}
                  </span>
                  <h3 className="text-lg font-bold tracking-tight text-white truncate mt-1">{selectedCustomer.name}</h3>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Badge variant="outline" className={`border-white/30 text-white bg-card/15 px-2 py-0 rounded text-[9px] font-semibold uppercase tracking-wider`}>
                      {getDynamicStatusLabel(selectedCustomer)}
                    </Badge>
                  </div>
                </div>
              </div>

              <CardContent className="p-6 space-y-5">
                {selectedCustomer.unitCode && (
                  <div className="space-y-1.5 animate-in fade-in duration-200">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Kavling / Unit Terikat</span>
                    <div className="bg-primary/5 border border-[#4F6F52]/20 rounded-2xl p-3 flex items-center justify-between text-xs font-semibold">
                      <span className="text-foreground">Kode Unit:</span>
                      <span className="font-mono text-primary font-black text-sm bg-card px-2 py-0.5 rounded border border-border">{selectedCustomer.unitCode}</span>
                    </div>
                  </div>
                )}

                {/* 16-Digit Formatting NIK Card */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">{t("cust.nik_title")}</span>
                  <div className="relative overflow-hidden bg-gradient-to-br from-[#4F6F52]/5 to-[#8FAF9A]/5 border border-border rounded-2xl p-4 shadow-sm">
                    {/* Tiny chip image decorator */}
                    <div className="w-8 h-6 bg-[#E9C46A]/60 border border-[#8A6D1D]/20 rounded-md mb-2 opacity-80" />
                    <p className="font-mono text-base tracking-widest text-foreground font-bold mb-1.5">
                      {formatNIK(selectedCustomer.nik)}
                    </p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
                      <span className="text-[9px] font-bold text-muted-foreground tracking-wider uppercase">{t("cust.nik_valid")}</span>
                      {selectedCustomer.nik && selectedCustomer.nik.length === 16 ? (
                        <div className="flex items-center gap-1 text-[9px] text-[#4FA56D] font-extrabold">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>{t("cust.nik_16_digit")}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[9px] text-[#D77A7A] font-extrabold">
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>{t("cust.nik_incomplete")}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact details */}
                <div className="grid grid-cols-1 gap-2 pt-1">
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-border/30 bg-muted/30/60 hover:bg-muted/30 transition-premium">
                    <div className="flex items-center gap-2 min-w-0">
                      <Phone className="w-4 h-4 text-primary" />
                      <span className="font-mono text-xs text-foreground font-bold truncate">{selectedCustomer.phone}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 hover:bg-[#8FAF9A]/10 rounded-lg text-muted-foreground cursor-pointer"
                      onClick={() => handleCopyPhone(selectedCustomer.phone)}
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-[#4FA56D]" /> : <Clipboard className="w-3.5 h-3.5" />}
                    </Button>
                  </div>

                  <div className="flex items-center p-2.5 rounded-xl border border-border/30 bg-muted/30/60 hover:bg-muted/30 transition-premium gap-2 min-w-0">
                    <Mail className="w-4 h-4 text-primary" />
                    <span className="text-xs text-foreground font-medium truncate">{selectedCustomer.email || t("cust.email_empty")}</span>
                  </div>
                </div>

                {/* Address & Source */}
                <div className="space-y-3 bg-muted/30/40 border border-border/30 rounded-2xl p-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">{t("cust.address_title")}</span>
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-xs text-foreground leading-relaxed font-semibold">
                        {selectedCustomer.address || t("cust.address_empty")}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-border/30 my-2 pt-2 flex justify-between items-center">
                    <div>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">{t("cust.source_title")}</span>
                      <span className="text-xs text-primary font-extrabold capitalize mt-0.5 block">
                        {selectedCustomer.source ? selectedCustomer.source.replace("_", " ") : "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">{t("cust.registered_since")}</span>
                      <span className="text-xs font-mono text-muted-foreground mt-0.5 block">
                        {selectedCustomer.createdAt ? new Date(selectedCustomer.createdAt).toLocaleDateString("id-ID") : "-"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Micro Alert Info */}
                <div className="bg-[#DCECF7]/40 border border-[#8FB8D8]/20 p-3 rounded-xl flex gap-2">
                  <Info className="w-4 h-4 text-[#33627A] shrink-0 mt-0.5" />
                  <p className="text-[10px] text-[#33627A] leading-relaxed font-medium">
                    {t("cust.alert_nik")}
                  </p>
                </div>

                {/* Actions Integrated */}
                {isEditor && (
                  <div className="flex gap-2 pt-4 border-t border-border/40 animate-in fade-in duration-200">
                    <div className="flex-1">
                      <CustomerForm
                        key={selectedCustomer.id}
                        id={selectedCustomer.id}
                        originalStatus={selectedCustomer.originalStatus}
                        paymentScheme={selectedCustomer.paymentScheme}
                        initialData={{
                          name: selectedCustomer.name,
                          nik: selectedCustomer.nik || "",
                          phone: selectedCustomer.phone,
                          email: selectedCustomer.email || "",
                          address: selectedCustomer.address || "",
                          source: selectedCustomer.source as CustomerInput["source"],
                          status: selectedCustomer.status as CustomerInput["status"],
                        }}
                      />
                    </div>
                    {/* Delete: ONLY Super Admin & Admin Kantor */}
                    {canDelete && (
                      <div className="shrink-0">
                        <DeleteConfirm
                          label={`konsumen "${selectedCustomer.name}"`}
                          onConfirm={async () => {
                            const res = await deleteCustomer(selectedCustomer.id);
                            setSelectedCustomerId(null);
                            return res;
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-2 border-border bg-muted/30/50 rounded-3xl p-8 text-center min-h-[300px] flex flex-col justify-center items-center">
              <div className="bg-secondary p-4 rounded-full mb-4">
                <User className="w-8 h-8 text-primary" />
              </div>
              <h4 className="text-sm font-bold text-foreground mb-1">{t("cust.select_title")}</h4>
              <p className="text-xs text-muted-foreground max-w-[220px] leading-relaxed mx-auto">
                {t("cust.select_desc")}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
