"use client";

import * as React from "react";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "textarea";
  placeholder?: string;
  options?: { value: string; label: string }[];
  className?: string;
}

/**
 * FormField compound component that combines Label + Input/Select/Textarea + inline error message.
 * Integrates with React Hook Form via useFormContext() for automatic field registration and error display.
 *
 * Must be used within a <FormProvider> (or a parent that calls useForm and wraps children with FormProvider).
 */
function FormField({
  name,
  label,
  type,
  placeholder,
  options,
  className,
}: FormFieldProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  // Resolve nested error paths (e.g., "address.street" → errors.address.street)
  const error = name.split(".").reduce<any>((acc, part) => acc?.[part], errors);
  const errorMessage = error?.message as string | undefined;

  const fieldId = `field-${name}`;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label
        htmlFor={fieldId}
        className="text-xs font-semibold text-[#243028]"
      >
        {label}
      </Label>

      {type === "textarea" ? (
        <Textarea
          id={fieldId}
          placeholder={placeholder}
          aria-invalid={!!errorMessage}
          className="bg-white border-[#D6DED2] rounded-xl text-xs focus:ring-[#8FAF9A] focus:ring-2 focus:border-transparent transition-all"
          {...register(name)}
        />
      ) : type === "select" ? (
        <select
          id={fieldId}
          aria-invalid={!!errorMessage}
          className={cn(
            "h-8 w-full rounded-xl border border-[#D6DED2] bg-white px-2.5 py-1 text-xs transition-colors outline-none focus:ring-[#8FAF9A] focus:ring-2 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
          )}
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
          aria-invalid={!!errorMessage}
          className="bg-white border-[#D6DED2] rounded-xl text-xs h-9 focus:ring-[#8FAF9A] focus:ring-2 focus:border-transparent transition-all"
          {...register(name, type === "number" ? { valueAsNumber: true } : undefined)}
        />
      )}

      {errorMessage && (
        <p className="text-xs text-red-500" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

export { FormField };
export type { FormFieldProps };
