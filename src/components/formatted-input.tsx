/**
 * Formatted Number Input
 *
 * Input field yang menampilkan angka dengan format ribuan Indonesia (titik)
 * tapi tetap menyimpan nilai asli sebagai number.
 */

"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormattedNumberInputProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export function FormattedNumberInput({
  id,
  label,
  value,
  onChange,
  onKeyDown,
  placeholder,
  className,
  inputClassName,
}: FormattedNumberInputProps) {
  // Format number with thousand separators (Indonesian style)
  const formatNumber = (num: string): string => {
    // Remove all non-digit characters
    const clean = num.replace(/\D/g, "");
    if (!clean) return "";
    // Add thousand separators
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  // Get the raw number (remove dots)
  const getRawValue = (formatted: string): string => {
    return formatted.replace(/\./g, "");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow only digits
    const clean = raw.replace(/\D/g, "");
    onChange(clean);
  };

  const displayValue = formatNumber(value);

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <Input
        id={id}
        value={displayValue}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder ? formatNumber(placeholder) : ""}
        autoComplete="off"
        spellCheck={false}
        inputMode="numeric"
        className={cn("font-mono", inputClassName)}
      />
    </div>
  );
}
