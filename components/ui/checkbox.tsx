import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, defaultChecked, ...props }, ref) => {
    const isControlled = checked !== undefined;
    const [internalChecked, setInternalChecked] = React.useState(Boolean(defaultChecked));
    const isChecked = isControlled ? Boolean(checked) : internalChecked;

    return (
      <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={(event) => {
            if (!isControlled) {
              setInternalChecked(event.target.checked);
            }
            props.onChange?.(event);
          }}
          className={cn(
            "peer size-4 appearance-none rounded-[4px] border border-[#8FAF9A] bg-white transition-colors",
            "checked:border-[#4F6F52] checked:bg-[#4F6F52]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        />
        <Check
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute size-3 text-white opacity-0 transition-opacity",
            isChecked && "opacity-100"
          )}
          strokeWidth={3}
        />
      </span>
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
