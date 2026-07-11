"use client"

interface DateSeparatorProps {
  label: string;
}

export function DateSeparator({ label }: DateSeparatorProps) {
  return (
    <div
      className="flex items-center gap-3 py-3 select-none"
      role="separator"
      aria-label={`Tanggal: ${label}`}
    >
      <div className="flex-1 h-px bg-[#D6DED2]" />
      <span className="text-[11px] font-semibold text-[#66736A] bg-background px-2 rounded-full">
        {label}
      </span>
      <div className="flex-1 h-px bg-[#D6DED2]" />
    </div>
  );
}
