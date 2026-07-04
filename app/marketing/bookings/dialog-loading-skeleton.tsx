"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface DialogLoadingSkeletonProps {
  height?: number;
  className?: string;
}

/**
 * Loading skeleton placeholder for dynamically loaded form dialog components.
 * Default height 200px as per design spec for form-dialog containers.
 */
export function DialogLoadingSkeleton({ height = 200, className }: DialogLoadingSkeletonProps) {
  return (
    <Skeleton
      className={`w-full rounded-xl ${className || ""}`}
      style={{ height: `${height}px` }}
    />
  );
}
