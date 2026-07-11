"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import EditBookingDialog from "@/app/marketing/bookings/edit-booking-dialog";
import CancelBookingDialog from "@/app/marketing/bookings/cancel-booking-dialog";
import { CheckCircle, Edit3, ShieldCheck } from "lucide-react";
import { akadAction } from "./akad-action";
import { useI18n } from "@/lib/i18n";

interface BookingActionsProps {
  /** Serializable booking data — no Date objects */
  booking: {
    id: string;
    bookingNumber: string;
    /** ISO string */
    bookingDate: string;
    bookingFee: number;
    dpAmount: number;
    paymentScheme: "cash" | "kpr" | "installment";
    termin?: number | null;
    status: string;
    marketingId: string;
    projectName?: string | null;
    unitCode?: string | null;
    customerName?: string | null;
    projectId?: string | null;
    unitId?: string | null;
    customerId?: string | null;
    cancellationReason?: string | null;
  };
  marketings: { id: string; name: string; roleName?: string | null }[];
  currentUser: { id: string; name: string };
  canEdit: boolean;
  canCancel: boolean;
  canUpgradeToAkad: boolean;
}

export default function BookingActionsClient({
  booking,
  marketings,
  currentUser,
  canEdit,
  canCancel,
  canUpgradeToAkad,
}: BookingActionsProps) {
  const { t } = useI18n();
  const [akadPending, setAkadPending] = React.useState(false);

  const handleAkad = async () => {
    setAkadPending(true);
    try {
      await akadAction(booking.id);
    } catch {
      setAkadPending(false);
    }
  };

  return (
    <>
      {/* Edit Booking Button */}
      {canEdit && (
        <EditBookingDialog
          booking={booking}
          marketings={marketings}
          currentUser={currentUser}
          triggerButton={
            <Button className="bg-primary hover:bg-[#3F5941] text-white font-bold rounded-xl px-3.5 py-2 flex items-center gap-1.5 shadow-[0_2px_8px_rgba(79,111,82,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all text-xs h-9 shrink-0">
              <Edit3 className="h-3.5 w-3.5" />
              {t("booking_detail.edit_booking")}
            </Button>
          }
        />
      )}

      {/* Cancel Booking Button */}
      {canCancel && (
        <CancelBookingDialog
          booking={{
            id: booking.id,
            bookingNumber: booking.bookingNumber,
            unitCode: booking.unitCode,
            status: booking.status,
            cancellationReason: booking.cancellationReason,
          }}
        />
      )}

      {/* Akad Upgrade Section */}
      {canUpgradeToAkad && (
        <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-blue-800 text-sm">{t("booking_detail.akad_title")}</p>
              <p className="text-xs text-blue-600 mt-0.5 mb-3">
                {t("booking_detail.akad_desc")}
              </p>
              <Button
                onClick={handleAkad}
                disabled={akadPending}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-xl font-bold shadow-[0_2px_8px_rgba(37,99,235,0.25)] hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {akadPending ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Memproses...
                  </span>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {t("booking_detail.akad_btn")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
