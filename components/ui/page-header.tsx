import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  /** Page title displayed next to the icon */
  title: React.ReactNode;
  /** Icon rendered inside the accent square */
  icon: React.ReactNode;
  /** Optional subtitle/description text below the title */
  description?: React.ReactNode;
  /** Optional actions slot (buttons, selectors) rendered on the right side */
  actions?: React.ReactNode;
  /** Additional CSS classes for the container */
  className?: string;
}

/**
 * Reusable page header component with gradient background and decorative blur elements.
 * Replaces the inline "PREMIUM HEADER" pattern used across pages (Bookings, Finance, etc.).
 *
 * Maintains the Sage Green gradient theme consistent with the app's design system.
 */
export function PageHeader({
  title,
  icon,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-[#D6DED2] p-6 shadow-sage animate-in fade-in duration-500",
        className
      )}
    >
      {/* Decorative blur circles */}
      <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 h-20 w-20 rounded-full bg-[#4F6F52]/5 blur-xl pointer-events-none" />

      {/* Content */}
      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Icon container */}
          <div className="h-12 w-12 rounded-2xl bg-[#4F6F52] text-white flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
            {icon}
          </div>

          {/* Title and description */}
          <div>
            <h1 className="text-2xl font-black text-[#243028] tracking-tight font-inter">
              {title}
            </h1>
            {description && (
              <p className="text-sm text-[#66736A] mt-0.5">{description}</p>
            )}
          </div>
        </div>

        {/* Actions slot */}
        {actions && (
          <div className="flex flex-wrap items-center gap-3 self-end md:self-center">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
