"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface SiteplanLoadingSkeletonProps {
  height?: number;
  className?: string;
}

/**
 * Loading skeleton placeholder for dynamically loaded siteplan components.
 * Default height 400px as per design spec for siteplan containers.
 */
export function SiteplanLoadingSkeleton({ height = 400, className }: SiteplanLoadingSkeletonProps) {
  return (
    <Skeleton
      className={`w-full rounded-xl ${className || ""}`}
      style={{ height: `${height}px` }}
    />
  );
}
