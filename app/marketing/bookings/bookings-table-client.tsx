"use client";

import * as React from "react";
import { useState, useCallback, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { useBulkSelection } from "@/hooks/use-bulk-selection";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { BulkDeleteConfirmDialog } from "@/components/ui/bulk-delete-confirm-dialog";
import { bulkDelete, bulkExport } from "@/server/actions/bulk";
import { handleActionResult } from "@/lib/action-utils";
import { formatRupiah, formatDate } from "@/lib/format-utils";
import { BookingIconLink } from "@/app/marketing/bookings/booking-icon-link";
import { Translate } from "@/components/translate";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
// Dialog imports — instantiated here in Client Component to avoid Server→Client function prop error
import EditBookingDialog from "@/app/marketing/bookings/edit-booking-dialog";
import CancelBookingDialog from "@/app/marketing/bookings/cancel-booking-dialog";

export interface BookingRow {
  id: string;
  bookingNumber: string;
  status: string;
  bookingDate: Date;
  bookingFee: number;
  dpAmount: number;
  paymentScheme: string;
  customerName: string | null;
  unitCode: string | null;
  projectName: string | null;
  marketingName: string | null;
  cancellationReason?: string | null;
}

interface BookingsTableClientProps {
  bookings: BookingRow[];
  /** Whether user has role to perform bulk delete (Super Admin / Admin Kantor) */
  canBulkDelete: boolean;
  /** Whether user can cancel bookings */
  canCancel: boolean;
  /** Session role info for action buttons */
  sessionRoleInfo: {
    isMarketing: boolean;
    isMarketingManager: boolean;
    isSuperAdmin: boolean;
    isAdminKantor: boolean;
  };
  /** Active user info */
  activeUser: { id: string; name: string };
  /** Total filtered items for display */
  totalFilteredItems: number;
  /** Render function for edit/cancel action buttons (since they need complex props) */
  renderActions?: (booking: BookingRow) => React.ReactNode;
  /** Marketings list for EditBookingDialog */
  marketings?: { id: string; name: string; roleName?: string | null }[];
}

const statusColorMap: Record<string, { bg: string; label: string }> = {
  active: { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Aktif" },
  cancelled: { bg: "bg-rose-50 text-rose-700 border-rose-200", label: "Batal" },
  akad: { bg: "bg-blue-50 text-blue-700 border-blue-200", label: "Akad" },
  completed: { bg: "bg-teal-50 text-teal-700 border-teal-200", label: "Akad Kredit" },
};

export function BookingsTableClient({
  bookings,
  canBulkDelete,
  totalFilteredItems,
  renderActions,
  canCancel,
  sessionRoleInfo,
  activeUser,
  marketings,
}: BookingsTableClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const {
    selectedIds,
    toggleItem,
    togglePage,
    clearSelection,
    isSelected,
    selectedCount,
  } = useBulkSelection();

  // Get page item IDs for "select all" on current page
  const pageIds = bookings.map((b) => b.id);

  // Check if all items on this page are selected
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => isSelected(id));

  // Handle export
  const handleExport = useCallback(async () => {
    setIsProcessing(true);
    try {
      const result = await bulkExport({
        entityType: "booking",
        ids: Array.from(selectedIds),
      });

      if (handleActionResult(result, { successMessage: `${result.success ? (result.data as { rowCount: number }).rowCount : 0} booking berhasil diekspor` })) {
        // Decode base64 and trigger download
        const data = (result as { success: true; data: { fileBase64: string; fileName: string; rowCount: number } }).data;
        const byteCharacters = atob(data.fileBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        clearSelection();
      }
    } catch {
      toast.error("Operasi gagal. Tidak ada data yang berubah.");
      clearSelection();
    } finally {
      setIsProcessing(false);
    }
  }, [selectedIds, clearSelection]);

  // Handle delete confirmation
  const handleDeleteConfirm = useCallback(async () => {
    setIsProcessing(true);
    try {
      const result = await bulkDelete({
        entityType: "booking",
        ids: Array.from(selectedIds),
      });

      if (result.success) {
        const { deleted, skipped } = result.data;
        let msg = `${deleted} booking berhasil dihapus.`;
        if (skipped.length > 0) {
          msg += ` ${skipped.length} item dilewati (status completed/akad).`;
        }
        toast.success(msg);
        clearSelection();
        setShowDeleteDialog(false);
        startTransition(() => {
          router.refresh();
        });
      } else {
        toast.error(result.error, { duration: 6000 });
        clearSelection();
        setShowDeleteDialog(false);
      }
    } catch {
      toast.error("Operasi gagal. Tidak ada data yang berubah.");
      clearSelection();
      setShowDeleteDialog(false);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedIds, clearSelection, router]);

  return (
    <>
      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedCount}
        onExport={handleExport}
        onDelete={canBulkDelete ? () => setShowDeleteDialog(true) : undefined}
        isProcessing={isProcessing || isPending}
        className="mb-3"
      />

      {/* Data Table */}
      <div className="bg-card border border-border rounded-2xl shadow-sage overflow-hidden">
        {/* Table Header Info */}
        <div className="px-6 py-3.5 border-b border-border bg-muted/30/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <Translate namespace="booking" translationKey="list_title" />
            </span>
            <span className="text-xs font-mono text-primary/70 tabular-nums">
              <Translate
                namespace="booking"
                translationKey="list_subtitle"
                values={{ filtered: totalFilteredItems.toString(), total: totalFilteredItems.toString() }}
              />
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs font-bold uppercase tracking-wider">
                {/* Checkbox column */}
                <th className="py-3.5 px-3 w-10">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={() => togglePage(pageIds)}
                    className="h-4 w-4 rounded border-[#B7CDB3] text-primary focus:ring-ring cursor-pointer"
                    aria-label="Pilih semua di halaman ini"
                  />
                </th>
                <th className="py-3.5 px-6">
                  <Translate namespace="booking" translationKey="col_number" />
                </th>
                <th className="py-3.5 px-6">
                  <Translate namespace="booking" translationKey="col_customer_unit" />
                </th>
                <th className="py-3.5 px-6">
                  <Translate namespace="booking" translationKey="col_marketing" />
                </th>
                <th className="py-3.5 px-6 text-right">
                  <Translate namespace="booking" translationKey="col_amount" />
                </th>
                <th className="py-3.5 px-6 text-center">
                  <Translate namespace="booking" translationKey="col_scheme" />
                </th>
                <th className="py-3.5 px-6 text-center">
                  <Translate namespace="booking" translationKey="col_status" />
                </th>
                <th className="py-3.5 px-6 text-right">
                  <Translate namespace="booking" translationKey="col_action" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D6DED2]/60 text-sm">
              {bookings.length > 0 ? (
                bookings.map((booking) => {
                  const initials = (booking.customerName || "TN")
                    .slice(0, 2)
                    .toUpperCase();
                  const statusStyle = statusColorMap[booking.status];
                  const selected = isSelected(booking.id);

                  return (
                    <tr
                      key={booking.id}
                      className={`hover:bg-muted/30/80 transition-colors duration-150 group ${
                        selected ? "bg-secondary/30" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-4 px-3">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleItem(booking.id)}
                          className="h-4 w-4 rounded border-[#B7CDB3] text-primary focus:ring-ring cursor-pointer"
                          aria-label={`Pilih booking ${booking.bookingNumber}`}
                        />
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-foreground font-mono text-[13px]">
                            {booking.bookingNumber || "-"}
                          </div>
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3 mr-1 text-primary/70" />
                            <span className="font-mono">
                              {formatDate(booking.bookingDate)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-full bg-secondary text-primary flex items-center justify-center font-bold text-xs shrink-0 border border-primary/20">
                            {initials}
                          </div>
                          <div className="space-y-0.5">
                            <div className="font-semibold text-foreground text-sm">
                              {booking.customerName || (
                                <Translate
                                  namespace="booking"
                                  translationKey="no_name"
                                />
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <span>{booking.projectName}</span>
                              <span className="text-muted-foreground/70">•</span>
                              <span className="font-mono bg-secondary/60 text-primary px-1.5 py-0.5 rounded text-[10px] font-semibold border border-primary/20">
                                {booking.unitCode || "-"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          {booking.marketingName ? (
                            <>
                              <div className="h-6 w-6 rounded-full bg-secondary text-primary flex items-center justify-center text-[9px] font-bold shrink-0">
                                {booking.marketingName.slice(0, 2).toUpperCase()}
                              </div>
                              <span className="text-sm font-medium text-foreground">
                                {booking.marketingName}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground/70 italic">
                              <Translate
                                namespace="booking"
                                translationKey="unassigned_marketing"
                              />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="space-y-0.5">
                          <div className="font-mono font-semibold text-primary tabular-nums text-sm">
                            {formatRupiah(booking.bookingFee + booking.dpAmount)}
                          </div>
                          <div className="text-[10px] text-muted-foreground/70 font-mono">
                            BF {formatRupiah(booking.bookingFee)} + DP{" "}
                            {formatRupiah(booking.dpAmount)}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <Badge
                          variant="outline"
                          className="uppercase font-semibold text-[10px] text-muted-foreground bg-muted/30 border-border rounded-md"
                        >
                          <Translate
                            namespace="booking"
                            translationKey={
                              `scheme_${booking.paymentScheme}`
                            }
                            fallback={booking.paymentScheme}
                          />
                        </Badge>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="space-y-1">
                          <Badge
                            className={`border font-semibold text-xs ${
                              statusStyle?.bg ||
                              "bg-slate-50 text-slate-600 border-slate-200"
                            } flex items-center gap-1 w-fit mx-auto rounded-full px-2.5 py-0.5`}
                          >
                            <Translate
                              namespace="booking"
                              translationKey={
                                `status_${booking.status}`
                              }
                              fallback={booking.status}
                            />
                          </Badge>
                          {booking.status === "cancelled" &&
                            booking.cancellationReason && (
                              <div
                                className="text-[10px] text-rose-600 italic font-medium truncate max-w-[130px] mx-auto"
                                title={booking.cancellationReason}
                              >
                                &quot;{booking.cancellationReason}&quot;
                              </div>
                            )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex justify-end items-center gap-1.5">
                          {/* Print receipt */}
                          {(booking.status === "active" ||
                            booking.status === "completed" ||
                            booking.status === "akad") && (
                            <BookingIconLink
                              href={`/marketing/bookings/${booking.id}/print`}
                              type="print"
                            />
                          )}
                          {/* Detail */}
                          <BookingIconLink
                            href={`/marketing/bookings/${booking.id}`}
                            type="view"
                          />
                          {/* Render additional actions from parent (edit, cancel, etc.) */}
                          {/* BUG FIX: Dialogs instantiated here to avoid Server→Client function prop error */}
                          {booking.status === "active" && (
                            <EditBookingDialog
                              booking={booking as unknown as React.ComponentProps<typeof EditBookingDialog>["booking"]}
                              marketings={marketings ?? []}
                              currentUser={activeUser ?? { id: "", name: "" }}
                            />
                          )}
                          {booking.status === "active" && canCancel && (
                            <CancelBookingDialog booking={booking} />
                          )}
                          {/* Legacy renderActions fallback for any remaining callers */}
                          {renderActions?.(booking)}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-16 w-16 rounded-full bg-secondary/50 flex items-center justify-center">
                        <Calendar className="h-8 w-8 text-primary/70" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">
                          <Translate
                            namespace="booking"
                            translationKey="not_found"
                          />
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          <Translate
                            namespace="booking"
                            translationKey="not_found_desc_1"
                          />
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <BulkDeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        count={selectedCount}
        onConfirm={handleDeleteConfirm}
        isProcessing={isProcessing}
      />
    </>
  );
}
