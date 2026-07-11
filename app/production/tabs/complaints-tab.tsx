"use client";

import * as React from "react";
import { useI18n } from "@/lib/i18n";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertTriangle, Eye } from "lucide-react";
import Link from "next/link";

interface Complaint {
  id: string;
  complaintNumber: string;
  customerId: string | null;
  unitId: string | null;
  category: string;
  description: string;
  status: string;
  resolvedAt: Date | null;
  createdAt: Date;
  customerName: string;
  unitCode: string;
  projectName: string;
}

interface ComplaintsTabProps {
  complaints: Complaint[];
  onNewComplaint: () => void;
  onResolveComplaint: (complaint: Complaint) => void;
}

export function ComplaintsTab({
  complaints,
  onNewComplaint,
  onResolveComplaint,
}: ComplaintsTabProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-foreground">{t("production.complaints_title")}</h3>
          <p className="text-xs text-muted-foreground">{t("production.complaints_desc")}</p>
        </div>
        <Button
          onClick={onNewComplaint}
          className="bg-primary hover:bg-primary text-primary-foreground font-semibold text-xs"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t("production.btn_new_complaint")}
        </Button>
      </div>

      <div className="rounded-md border border-primary/20 overflow-hidden">
        <Table>
          <TableHeader className="bg-[#8FAF9A]/10">
            <TableRow>
              <TableHead className="font-semibold text-primary">{t("production.col_ticket_no")}</TableHead>
              <TableHead className="font-semibold text-primary">{t("production.col_customer")}</TableHead>
              <TableHead className="font-semibold text-primary">{t("production.col_kavling")}</TableHead>
              <TableHead className="font-semibold text-primary">{t("production.col_category")}</TableHead>
              <TableHead className="font-semibold text-primary">{t("production.col_complaint_desc")}</TableHead>
              <TableHead className="font-semibold text-primary">{t("production.col_report_date")}</TableHead>
              <TableHead className="font-semibold text-primary">{t("production.col_status")}</TableHead>
              <TableHead className="font-semibold text-primary text-right">{t("production.col_action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {complaints.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-16 w-16 rounded-full bg-secondary/50 flex items-center justify-center mx-auto">
                      <AlertTriangle className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">{t("production.complaint_empty")}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t("production.complaint_empty_desc")}</p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              complaints.map((c) => (
                <TableRow key={c.id} className="hover:bg-[#8FAF9A]/5 transition-colors duration-150">
                  <TableCell className="font-bold tabular-nums text-foreground">{c.complaintNumber}</TableCell>
                  <TableCell className="font-medium text-foreground">{c.customerName}</TableCell>
                  <TableCell className="font-semibold text-foreground">{c.unitCode}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs border-primary/50 text-primary bg-[#8FAF9A]/5 font-semibold shadow-none">
                      {c.category === "quality" ? t("production.cat_quality") : c.category === "delay" ? t("production.cat_delay") : c.category === "document" ? t("production.cat_document") : c.category === "payment" ? t("production.cat_payment") : t("production.cat_other")}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-foreground max-w-[240px] truncate">{c.description}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`shadow-none font-semibold ${
                        c.status === "resolved"
                          ? "bg-secondary text-primary border border-primary/30"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {c.status === "resolved" ? t("production.status_done") : t("production.status_open")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/production/complaints/${c.id}`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-primary/50 text-primary hover:bg-secondary/50 font-semibold text-xs h-8"
                        >
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          Detail
                        </Button>
                      </Link>
                      {c.status === "open" && (
                        <Button
                          size="sm"
                          onClick={() => onResolveComplaint(c)}
                          className="bg-primary hover:bg-primary text-primary-foreground font-semibold text-xs h-8"
                        >
                          {t("production.btn_resolve")}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
