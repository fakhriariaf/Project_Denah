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
import { Download } from "lucide-react";
import {
  DynamicFinanceBarChart,
  ChartErrorBoundary,
} from "@/components/charts";

interface ReportsTabProps {
  totalIncomeVal: number;
  totalExpenseVal: number;
  netBalanceVal: number;
  monthlyData: Array<{ name: string; Nominal: number; fill: string }>;
}

export function ReportsTab({
  totalIncomeVal,
  totalExpenseVal,
  netBalanceVal,
  monthlyData,
}: ReportsTabProps) {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card className="bg-white border-[#D6DED2]">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg text-[#243028]">{t("finance.report_title")}</CardTitle>
              <CardDescription className="text-xs">{t("finance.report_desc")}</CardDescription>
            </div>
            <Button className="bg-[#4F6F52] hover:bg-[#8FAF9A] text-white flex items-center gap-1.5 text-xs">
              <Download className="h-4 w-4" /> {t("finance.report_btn_export")}
            </Button>
          </CardHeader>
          <CardContent className="w-full min-w-0 p-4">
            <div style={{ height: 280, minHeight: 0, minWidth: 0 }}>
              <ChartErrorBoundary fallbackHeight={280}>
                <DynamicFinanceBarChart data={monthlyData} />
              </ChartErrorBoundary>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="bg-white border-[#D6DED2]">
          <CardHeader>
            <CardTitle className="text-base text-[#243028]">{t("finance.cashflow_title")}</CardTitle>
            <CardDescription className="text-xs">{t("finance.cashflow_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3 font-sans">
            <div className="flex justify-between items-center text-xs border-b border-[#D6DED2] pb-2">
              <span className="text-[#66736A]">{t("finance.cashflow_income")}</span>
              <span className="font-mono font-bold text-[#4F6F52] tabular-nums">
                Rp {totalIncomeVal.toLocaleString("id-ID")}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs border-b border-[#D6DED2] pb-2">
              <span className="text-[#66736A]">{t("finance.cashflow_expense")}</span>
              <span className="font-mono font-bold text-danger tabular-nums">
                Rp {totalExpenseVal.toLocaleString("id-ID")}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs font-semibold pt-1">
              <span className="text-[#243028]">{t("finance.cashflow_net")}</span>
              <span className="font-mono font-bold text-lg text-[#4F6F52] tabular-nums">
                Rp {netBalanceVal.toLocaleString("id-ID")}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
