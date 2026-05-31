"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DataTablePaginationProps {
  totalItems: number;
  itemsPerPage?: number;
}

export function DataTablePagination({
  totalItems,
  itemsPerPage = 20,
}: DataTablePaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentPage = Number(searchParams.get("page")) || 1;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`?${params.toString()}`);
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-[#D6DED2] bg-white/70 backdrop-blur-md rounded-b-2xl">
      <div className="text-xs text-[#66736A] font-medium font-sans">
        Menampilkan <span className="font-semibold text-[#243028] font-mono">{(currentPage - 1) * itemsPerPage + 1}</span> -{" "}
        <span className="font-semibold text-[#243028] font-mono">{Math.min(currentPage * itemsPerPage, totalItems)}</span> dari{" "}
        <span className="font-semibold text-[#243028] font-mono">{totalItems}</span> data
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === 1}
          onClick={() => handlePageChange(currentPage - 1)}
          className="h-8 w-8 p-0 rounded-xl border-[#D6DED2] hover:bg-[#F7F8F3] hover:text-[#4F6F52] disabled:opacity-40 transition-all"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <span className="text-xs font-semibold text-[#66736A] font-sans">
          Halaman <span className="font-mono">{currentPage}</span> dari <span className="font-mono">{totalPages}</span>
        </span>

        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === totalPages}
          onClick={() => handlePageChange(currentPage + 1)}
          className="h-8 w-8 p-0 rounded-xl border-[#D6DED2] hover:bg-[#F7F8F3] hover:text-[#4F6F52] disabled:opacity-40 transition-all"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
