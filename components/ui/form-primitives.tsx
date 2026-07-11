"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Standard ERP form primitives.
 *
 * Canonical building blocks so every form (master data, finance, marketing,
 * production) shares the same label style, required indicator, helper text,
 * and accessible error message. Uses theme tokens only — no hardcoded colors.
 */

/** Red asterisk marking a required field. Announced to screen readers as "required". */
export function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden="true">
      *
    </span>
  );
}

interface FormLabelProps extends React.ComponentProps<typeof Label> {
  required?: boolean;
}

/** Standard field label. Pass `required` to append the required mark. */
export function FormLabel({ required, children, className, ...props }: FormLabelProps) {
  return (
    <Label className={cn("text-xs font-semibold text-foreground", className)} {...props}>
      {children}
      {required && <RequiredMark />}
    </Label>
  );
}

interface FieldHelpProps {
  id?: string;
  children: React.ReactNode;
  className?: string;
}

/** Muted helper/description text shown below a field. */
export function FieldHelp({ id, children, className }: FieldHelpProps) {
  return (
    <p id={id} className={cn("text-xs text-muted-foreground", className)}>
      {children}
    </p>
  );
}

interface FieldErrorProps {
  id?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Accessible field error message. Rendered with `role="alert"` so screen
 * readers announce it when validation fails. Renders nothing when empty.
 */
export function FieldError({ id, children, className }: FieldErrorProps) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className={cn("text-xs font-medium text-destructive", className)}>
      {children}
    </p>
  );
}

interface FormFieldGroupProps {
  children: React.ReactNode;
  className?: string;
}

/** Consistent vertical spacing wrapper for a label + control + message. */
export function FormFieldGroup({ children, className }: FormFieldGroupProps) {
  return <div className={cn("space-y-1.5", className)}>{children}</div>;
}
