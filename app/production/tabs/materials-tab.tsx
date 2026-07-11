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
import { Plus } from "lucide-react";

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

interface MaterialsTabProps {
  materialRequests: MaterialRequest[];
  onNewMaterial: () => void;
  onSubmitToFinance: (requestId: string) => Promise<void>;
}

export function MaterialsTab({
  materialRequests,
  onNewMaterial,
  onSubmitToFinance,
}: MaterialsTabProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-foreground">{t("production.materials_title")}</h3>
          <p className="text-xs text-muted-foreground">{t("production.materials_desc")}</p>
        </div>
        <Button
          onClick={onNewMaterial}
          className="bg-primary hover:bg-primary text-primary-foreground font-semibold text-xs"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t("production.btn_new_material")}
        </Button>
      </div>

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
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-16 w-16 rounded-full bg-secondary/50 flex items-center justify-center mx-auto">
                      <Plus className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">{t("production.material_empty")}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t("production.material_empty_desc")}</p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              materialRequests.map((m) => (
                <TableRow key={m.id} className="hover:bg-[#8FAF9A]/5 transition-colors duration-150">
                  <TableCell className="font-bold tabular-nums text-foreground">{m.requestNumber}</TableCell>
                  <TableCell className="font-semibold text-foreground">{m.spkNumber}</TableCell>
                  <TableCell className="font-medium text-foreground max-w-[200px] truncate">{m.description}</TableCell>
                  <TableCell className="font-semibold text-foreground">{m.unitCode}</TableCell>
                  <TableCell className="font-bold text-foreground tabular-nums">
                    Rp {m.estimatedAmount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`shadow-none font-semibold text-xs ${
                        m.status === "approved" || m.status === "purchased"
                          ? "bg-secondary text-primary border border-primary/30"
                          : m.status === "finance_pending"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : m.status === "rejected"
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : "bg-gray-100 text-gray-700 border border-gray-200"
                      }`}
                    >
                      {m.status === "approved" || m.status === "purchased"
                        ? t("production.mat_status_approved")
                        : m.status === "finance_pending"
                        ? t("production.mat_status_pending")
                        : m.status === "rejected"
                        ? t("production.mat_status_rejected")
                        : t("production.status_draft")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {m.status === "draft" && (
                      <Button
                        size="sm"
                        onClick={() => onSubmitToFinance(m.id)}
                        className="bg-primary hover:bg-primary text-primary-foreground font-semibold text-xs h-8"
                      >
                        {t("production.btn_submit_to_finance")}
                      </Button>
                    )}
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
