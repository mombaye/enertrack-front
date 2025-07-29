// src/components/SearchInput.tsx
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import React from "react";

export function SearchInput({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative w-64 ${className}`}>
      <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-900 opacity-70 pointer-events-none" />
      <Input
        className="pl-10"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        type="text"
      />
    </div>
  );
}
