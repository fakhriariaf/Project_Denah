"use client";

import React from "react";

export default function PageLoader() {
  return (
    <div className="w-full h-full flex flex-col space-y-6 animate-pulse select-none">
      {/* 1. Glowing Top Progress Loader Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 z-50 overflow-hidden bg-[#DDE8D8]">
        <div 
          className="h-full bg-gradient-to-r from-[#8FAF9A] via-[#4F6F52] to-[#8FAF9A] rounded-full shadow-[0_0_8px_#4F6F52]"
          style={{
            animation: "progressRunning 1.5s infinite linear",
            width: "60%"
          }}
        />
      </div>

      {/* 2. Header Skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 bg-[#DDE8D8]/70 rounded-lg" />
        <div className="h-4 w-96 bg-[#DDE8D8]/40 rounded-md" />
      </div>

      {/* 3. Metrics Grid Skeleton (4 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white border border-[#D6DED2] p-5 rounded-2xl flex items-center justify-between shadow-sage">
            <div className="space-y-2 flex-1">
              <div className="h-3 w-20 bg-[#DDE8D8]/70 rounded" />
              <div className="h-7 w-12 bg-[#DDE8D8]/90 rounded-md" />
              <div className="h-2 w-16 bg-[#DDE8D8]/40 rounded" />
            </div>
            <div className="h-10 w-10 bg-[#DDE8D8]/60 rounded-xl flex-shrink-0" />
          </div>
        ))}
      </div>

      {/* 4. Large Table Grid Skeleton */}
      <div className="bg-white border border-[#D6DED2] rounded-2xl shadow-sage overflow-hidden flex flex-col flex-1">
        {/* Table Filter Bar Skeleton */}
        <div className="p-4 border-b border-[#D6DED2] flex items-center justify-between gap-4">
          <div className="h-10 bg-[#F7F8F3] border border-[#D6DED2] rounded-xl flex-1 max-w-md" />
          <div className="h-10 w-32 bg-[#F7F8F3] border border-[#D6DED2] rounded-xl" />
        </div>

        {/* Table Header Skeleton */}
        <div className="px-6 py-3 border-b border-[#D6DED2] bg-[#F7F8F3]/60">
          <div className="grid grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-3 bg-[#DDE8D8]/70 rounded" />
            ))}
          </div>
        </div>

        {/* Table Rows Skeleton */}
        <div className="p-6 space-y-4">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="grid grid-cols-6 gap-4 py-3 border-b border-[#D6DED2]/50 last:border-0">
              <div className="h-4 bg-[#DDE8D8]/60 rounded col-span-1" />
              <div className="h-4 bg-[#DDE8D8]/50 rounded col-span-1" />
              <div className="h-4 bg-[#DDE8D8]/50 rounded col-span-1" />
              <div className="h-4 bg-[#DDE8D8]/50 rounded col-span-1" />
              <div className="h-4 bg-[#DDE8D8]/50 rounded col-span-1" />
              <div className="h-4 bg-[#DDE8D8]/30 rounded col-span-1 ml-auto w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
