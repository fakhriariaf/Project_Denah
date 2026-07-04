"use client";

import { ErrorPage } from "@/components/ui/error-page";

export default function MasterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorPage error={error} reset={reset} />;
}
