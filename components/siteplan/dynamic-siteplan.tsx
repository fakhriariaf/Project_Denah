"use client";

import dynamic from "next/dynamic";
import { SiteplanLoadingSkeleton } from "./siteplan-loading-skeleton";
import { SiteplanErrorBoundary } from "./siteplan-error-boundary";
import type { ComponentProps } from "react";

/**
 * Dynamic import wrappers for Siteplan components with ssr: false.
 * These components depend on DOM/SVG APIs (getScreenCTM, matrixTransform)
 * and must only render on the client side.
 * Includes loading skeleton (400px height) and error boundary integration.
 */

// Siteplan Viewer (interactive SVG with CTM inversion)
const DynamicSiteplanViewerInner = dynamic(
  () =>
    import("@/components/siteplan/siteplan-viewer").then(
      (mod) => mod.SiteplanViewer
    ),
  {
    ssr: false,
    loading: () => <SiteplanLoadingSkeleton height={400} />,
  }
);

// Siteplan Editor (polygon drawing with SVG coordinate transforms)
const DynamicSiteplanEditorInner = dynamic(
  () =>
    import("@/components/siteplan/siteplan-editor").then(
      (mod) => mod.SiteplanEditor
    ),
  {
    ssr: false,
    loading: () => <SiteplanLoadingSkeleton height={400} />,
  }
);

/**
 * DynamicSiteplanViewer wrapped with error boundary for chunk load failures.
 * Drop-in replacement for SiteplanViewer with lazy loading + error recovery.
 */
export function DynamicSiteplanViewer(
  props: ComponentProps<typeof DynamicSiteplanViewerInner>
) {
  return (
    <SiteplanErrorBoundary fallbackHeight={400}>
      <DynamicSiteplanViewerInner {...props} />
    </SiteplanErrorBoundary>
  );
}

/**
 * DynamicSiteplanEditor wrapped with error boundary for chunk load failures.
 * Drop-in replacement for SiteplanEditor with lazy loading + error recovery.
 */
export function DynamicSiteplanEditor(
  props: ComponentProps<typeof DynamicSiteplanEditorInner>
) {
  return (
    <SiteplanErrorBoundary fallbackHeight={400}>
      <DynamicSiteplanEditorInner {...props} />
    </SiteplanErrorBoundary>
  );
}
