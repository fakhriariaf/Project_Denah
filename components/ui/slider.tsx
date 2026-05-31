import * as React from "react"
import { cn } from "@/lib/utils"

export interface SliderProps {
  className?: string
  min?: number
  max?: number
  step?: number
  value?: number[]
  onValueChange?: (value: number[]) => void
}

function Slider({
  className,
  min = 0,
  max = 100,
  step = 1,
  value,
  onValueChange,
  ...props
}: SliderProps) {
  const val = value?.[0] ?? min

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onValueChange?.([Number(e.target.value)])
  }

  return (
    <div className={cn("relative flex w-full touch-none select-none items-center py-2", className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={val}
        onChange={handleChange}
        className="w-full h-1.5 bg-[#8FAF9A]/20 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
        {...props}
      />
    </div>
  )
}

export { Slider }
