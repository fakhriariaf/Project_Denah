"use client";

import React from "react";
import { Check, CircleDot } from "lucide-react";

export interface KprTrackerData {
  unitStatus: string;
  kprStatus: string;
  isReadyStock: boolean;
  readyStockSource: string | null;
  constructionProgress: number;
}

export function KprMilestoneTracker({ 
  data, 
  orientation = "vertical" 
}: { 
  data: KprTrackerData,
  orientation?: "horizontal" | "vertical"
}) {
  const isReady = data.isReadyStock === true || data.readyStockSource === "legacy_ready_stock" || data.readyStockSource === "manual_ready_stock";
  const physicalReady = (data.constructionProgress || 0) === 100;

  // Steps mirror kanban COLUMNS exactly (same IDs, same order, same conditions)
  const steps = [
    { key: "available",        label: isReady ? "Tersedia - Ready Stock" : "Tersedia" },
    { key: "booking_fee",      label: "Booking Fee" },
    { key: "bi_checking",      label: "BI Checking" },
    { key: "pemberkasan",      label: "Pemberkasan" },
    { key: "proses_bank",      label: "Proses Bank" },
    { key: "offering",         label: "Offering Letter" },
    { key: "approved",         label: "Approval / SP3K" },
    { key: "akad",             label: "Akad Kredit" },
    { key: "realisasi",        label: "Realisasi Dana Bank" },
  ];

  if (!isReady) {
    steps.push({ key: "physical_waiting", label: "Cek Fisik Unit" });
  }

  steps.push(
    { key: "handover_waiting", label: "Menunggu Serah Terima" },
    { key: "bast_developer",   label: "BAST Developer ke Konsumen" },
    { key: "handover_done",    label: "Serah Terima Selesai" }
  );

  // Map kprStatus to the correct step index — mirrors getCardKanbanColumn() logic
  let currentIndex = 0;
  const getIndex = (key: string) => steps.findIndex(s => s.key === key);

  if (data.unitStatus === "handover_complete") {
    currentIndex = getIndex("handover_done");
  } else if (data.unitStatus === "menunggu_serah_terima") {
    const bastExists = false; // tracker doesn't have doc data — show handover_waiting
    currentIndex = getIndex("handover_waiting");
  } else if (data.kprStatus === "realisasi") {
    if (!isReady && !physicalReady) {
      currentIndex = getIndex("physical_waiting");
    } else {
      currentIndex = getIndex("realisasi");
    }
  } else if (data.kprStatus === "akad") {
    currentIndex = getIndex("akad");
  } else if (data.kprStatus === "approved") {
    currentIndex = getIndex("approved");
  } else if (data.kprStatus === "offering") {
    currentIndex = getIndex("offering");
  } else if (data.kprStatus === "proses_bank") {
    currentIndex = getIndex("proses_bank");
  } else if (data.kprStatus === "pemberkasan") {
    currentIndex = getIndex("pemberkasan");
  } else if (data.kprStatus === "rejected") {
    currentIndex = getIndex("pemberkasan"); // rejected stays at pemberkasan level visually
  } else if (data.kprStatus === "bi_checking") {
    currentIndex = getIndex("bi_checking");
  } else {
    currentIndex = getIndex("booking_fee");
  }

  if (currentIndex === -1) currentIndex = 0;

  return (
    <div className={`flex ${orientation === "vertical" ? "flex-col" : "flex-row overflow-x-auto pb-4"} gap-0 relative w-full`}>
      {steps.map((stage, index) => {
        const isCompleted = index < currentIndex;
        const isActive = index === currentIndex;
        
        let colorClasses = "";
        let Icon = CircleDot;

        if (isCompleted) {
          colorClasses = "bg-primary text-white border-[#4F6F52]";
          Icon = Check;
        } else if (isActive) {
          colorClasses = "bg-card text-primary border-[#4F6F52] border-2 shadow-sm ring-4 ring-[#DDE8D8]/50";
          Icon = CircleDot;
        } else {
          colorClasses = "bg-muted/30 text-muted-foreground/70 border-border";
          Icon = CircleDot;
        }

        return (
          <div key={stage.key} className={`flex ${orientation === "vertical" ? "flex-row" : "flex-col"} items-center relative flex-1`}>
            {/* Connector Line */}
            {index !== steps.length - 1 && (
              <div 
                className={`absolute ${
                  orientation === "vertical" 
                    ? "left-4 top-8 bottom-[-8px] w-[2px]" 
                    : "top-4 left-[50%] right-[-50%] h-[2px]"
                } ${isCompleted ? "bg-primary" : "bg-[#D6DED2]"}`} 
              />
            )}
            
            <div className={`flex ${orientation === "vertical" ? "flex-row w-full justify-start py-2" : "flex-col w-full justify-center px-2"} items-center gap-3 z-10 relative`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${colorClasses} transition-all duration-300`}>
                <Icon className={`w-4 h-4 ${isActive ? "animate-pulse" : ""}`} />
              </div>
              <div className={`${orientation === "vertical" ? "text-left" : "text-center mt-2"} flex-1`}>
                <p className={`text-xs ${isActive ? "font-black text-foreground" : isCompleted ? "font-bold text-muted-foreground" : "font-medium text-muted-foreground/70"}`}>
                  {stage.label}
                </p>
                {isActive && (
                  <p className="text-[10px] text-primary font-semibold mt-0.5">Tahap Saat Ini</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
