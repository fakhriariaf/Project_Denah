import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
  /** Show a decorative background illustration. Defaults to true. */
  showIllustration?: boolean;
}

function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  showIllustration = true,
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "relative flex flex-col items-center justify-center py-16 px-6 text-center overflow-hidden",
        className
      )}
    >
      {/* Decorative background circles */}
      {showIllustration && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-secondary/30 blur-2xl" />
          <div className="absolute top-1/3 left-1/3 w-24 h-24 rounded-full bg-primary/5 blur-xl" />
        </div>
      )}

      <div className="relative">
        {icon ? (
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-secondary/60 border border-border/50 text-primary shadow-sm">
            {icon}
          </div>
        ) : (
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-secondary/60 border border-border/50 text-muted-foreground shadow-sm">
            <Inbox className="h-6 w-6" />
          </div>
        )}
      </div>

      <h3 className="relative font-heading text-base font-bold text-foreground">
        {title}
      </h3>
      <p className="relative mt-1.5 max-w-xs text-xs text-muted-foreground leading-relaxed">
        {description}
      </p>
      {action && (
        <div className="relative mt-5">
          {action.href ? (
            <Link
              href={action.href}
              className={cn(buttonVariants({ variant: "default", size: "sm" }), "btn-premium rounded-xl text-xs font-bold")}
            >
              {action.label}
            </Link>
          ) : (
            <Button variant="default" size="sm" onClick={action.onClick} className="btn-premium rounded-xl text-xs font-bold">
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps };
