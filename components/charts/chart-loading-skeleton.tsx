"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface ChartLoadingSkeletonProps {
  height?: number;
  className?: string;
}

/**
 * Loading skeleton placeholder for dynamically loaded chart components.
 * Default height 300px as per design spec for chart containers.
 */
export function ChartLoadingSkeleton({ height = 300, className }: ChartLoadingSkeletonProps) {
  return (
    <Skeleton
      className={`w-full rounded-xl ${className || ""}`}
      style={{ height: `${height}px` }}
    />
  );
}
