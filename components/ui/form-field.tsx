"use client";

import * as React from "react";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormLabel, FieldError, FieldHelp, FormFieldGroup } from "@/components/ui/form-primitives";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "textarea";
  placeholder?: string;
  options?: { value: string; label: string }[];
  className?: string;
  required?: boolean;
  /** Optional helper/description text shown below the label. */
  helpText?: string;
  disabled?: boolean;
}

/**
 * FormField compound component: Label + Input/Select/Textarea + inline error.
 * Integrates with React Hook Form via useFormContext() for automatic field
 * registration and error display. Uses theme tokens only (no hardcoded colors).
 *
 * Must be used within a <FormProvider>.
 */
function FormField({
  name,
  label,
  type,
  placeholder,
  options,
  className,
  required,
  helpText,
  disabled,
}: FormFieldProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  // Resolve nested error paths (e.g., "address.street" → errors.address.street)
  const error = name.split(".").reduce<any>((acc, part) => acc?.[part], errors);
  const errorMessage = error?.message as string | undefined;

  const fieldId = `field-${name}`;
  const helpId = helpText ? `${fieldId}-help` : undefined;
  const errorId = errorMessage ? `${fieldId}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;

  const controlClasses =
    "bg-card border-input rounded-xl text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent transition-all disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive";

  return (
    <FormFieldGroup className={className}>
      <FormLabel htmlFor={fieldId} required={required}>
        {label}
      </FormLabel>

      {helpText && <FieldHelp id={helpId}>{helpText}</FieldHelp>}

      {type === "textarea" ? (
        <Textarea
          id={fieldId}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={!!errorMessage}
          aria-describedby={describedBy}
          className={controlClasses}
          {...register(name)}
        />
      ) : type === "select" ? (
        <select
          id={fieldId}
          disabled={disabled}
          aria-invalid={!!errorMessage}
          aria-describedby={describedBy}
          className={cn("h-9 w-full px-2.5 py-1 outline-none", controlClasses)}
          {...register(name)}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <Input
          id={fieldId}
          type={type}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={!!errorMessage}
          aria-describedby={describedBy}
          className={cn("h-9", controlClasses)}
          {...register(name, type === "number" ? { valueAsNumber: true } : undefined)}
        />
      )}

      <FieldError id={errorId}>{errorMessage}</FieldError>
    </FormFieldGroup>
  );
}

export { FormField };
export type { FormFieldProps };
