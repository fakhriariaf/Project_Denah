import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

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
}

function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      {icon && (
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-[#DDE8D8] text-[#4F6F52]">
          {icon}
        </div>
      )}
      <h3 className="font-heading text-lg font-medium text-foreground">
        {title}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {action && (
        <div className="mt-4">
          {action.href ? (
            <Link
              href={action.href}
              className={cn(buttonVariants({ variant: "default", size: "default" }))}
            >
              {action.label}
            </Link>
          ) : (
            <Button variant="default" onClick={action.onClick}>
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
