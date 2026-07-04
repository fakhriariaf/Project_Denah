"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SiteplanErrorBoundaryProps {
  children: React.ReactNode;
  fallbackHeight?: number;
}

interface SiteplanErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary specifically for dynamically loaded siteplan components.
 * Catches chunk load failures and displays a retry button.
 * Message: "Gagal memuat komponen. Klik untuk coba lagi."
 */
export class SiteplanErrorBoundary extends React.Component<
  SiteplanErrorBoundaryProps,
  SiteplanErrorBoundaryState
> {
  constructor(props: SiteplanErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): SiteplanErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[SiteplanErrorBoundary] Chunk load failure:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const height = this.props.fallbackHeight || 400;
      return (
        <div
          className="flex flex-col items-center justify-center rounded-xl border border-[#D6DED2] bg-[#F7F8F3]/50"
          style={{ height: `${height}px` }}
        >
          <AlertTriangle className="h-8 w-8 text-[#4F6F52] mb-3" />
          <p className="text-sm font-medium text-[#66736A] mb-3">
            Gagal memuat komponen. Klik untuk coba lagi.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleRetry}
            className="border-[#D6DED2] hover:bg-[#DDE8D8] text-[#4F6F52]"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Coba Lagi
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
