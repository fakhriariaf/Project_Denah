"use client";

import dynamic from "next/dynamic";
import { ChartLoadingSkeleton } from "./chart-loading-skeleton";

/**
 * Dynamic import wrappers for Recharts components with ssr: false.
 * Each chart is loaded on-demand to reduce initial bundle size.
 * Includes loading skeleton and error boundary integration.
 */

// Dashboard Area Chart (Cash Flow)
export const DynamicDashboardAreaChart = dynamic(
  () => import("@/components/charts/dashboard-area-chart"),
  {
    ssr: false,
    loading: () => <ChartLoadingSkeleton height={300} />,
  }
);

// Dashboard Pie Chart (Unit Status Distribution)
export const DynamicDashboardPieChart = dynamic(
  () => import("@/components/charts/dashboard-pie-chart"),
  {
    ssr: false,
    loading: () => <ChartLoadingSkeleton height={300} />,
  }
);

// Finance Bar Chart (Monthly Transactions)
export const DynamicFinanceBarChart = dynamic(
  () => import("@/components/charts/finance-bar-chart"),
  {
    ssr: false,
    loading: () => <ChartLoadingSkeleton height={280} />,
  }
);

// Reports Bar Chart (Financial Report)
export const DynamicReportsBarChart = dynamic(
  () => import("@/components/charts/reports-bar-chart"),
  {
    ssr: false,
    loading: () => <ChartLoadingSkeleton height={260} />,
  }
);
