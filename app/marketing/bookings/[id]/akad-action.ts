"use server";

import { completeBookingAkad, upgradeBookingToAkad } from "@/server/actions/marketing";
import { redirect } from "next/navigation";

export async function akadAction(bookingId: string) {
  try {
    await upgradeBookingToAkad(bookingId);
  } catch (err: any) {
    // Re-throw with a descriptive message so Next.js error boundary shows proper info
    throw new Error(err.message || "Gagal memproses akad. Silakan coba lagi.");
  }
  // Redirect only after success — if error thrown above, redirect won't execute
  redirect(`/marketing/bookings/${bookingId}`);
}

export async function completeAkadAction(bookingId: string) {
  try {
    await completeBookingAkad(bookingId);
  } catch (err: any) {
    throw new Error(err.message || "Gagal menyelesaikan Akad / PPJB. Silakan coba lagi.");
  }
  redirect(`/marketing/bookings/${bookingId}`);
}
