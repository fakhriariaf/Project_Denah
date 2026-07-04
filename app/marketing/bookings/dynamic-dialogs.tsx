"use client";

import dynamic from "next/dynamic";
import { DialogLoadingSkeleton } from "./dialog-loading-skeleton";
import { DynamicLoadErrorBoundary } from "@/components/ui/dynamic-load-error-boundary";
import type { ComponentProps } from "react";

/**
 * Dynamic import wrappers for Form Dialog components with ssr: false.
 * Each dialog is loaded on-demand to reduce the initial bundle size
 * of the bookings list page.
 * Includes loading skeleton (200px height) and error boundary for chunk load failures.
 */

// AddBookingDialog - dynamically loaded to split form code from list page
const LazyAddBookingDialog = dynamic(
  () => import("@/app/marketing/bookings/add-booking-dialog"),
  {
    ssr: false,
    loading: () => <DialogLoadingSkeleton height={200} />,
  }
);

// EditBookingDialog - dynamically loaded to split form code from list page
const LazyEditBookingDialog = dynamic(
  () => import("@/app/marketing/bookings/edit-booking-dialog"),
  {
    ssr: false,
    loading: () => <DialogLoadingSkeleton height={200} />,
  }
);

/**
 * DynamicAddBookingDialog wraps the lazy-loaded AddBookingDialog
 * with an error boundary that catches chunk load failures.
 */
export function DynamicAddBookingDialog(props: ComponentProps<typeof LazyAddBookingDialog>) {
  return (
    <DynamicLoadErrorBoundary fallbackHeight={200}>
      <LazyAddBookingDialog {...props} />
    </DynamicLoadErrorBoundary>
  );
}

/**
 * DynamicEditBookingDialog wraps the lazy-loaded EditBookingDialog
 * with an error boundary that catches chunk load failures.
 */
export function DynamicEditBookingDialog(props: ComponentProps<typeof LazyEditBookingDialog>) {
  return (
    <DynamicLoadErrorBoundary fallbackHeight={200}>
      <LazyEditBookingDialog {...props} />
    </DynamicLoadErrorBoundary>
  );
}
