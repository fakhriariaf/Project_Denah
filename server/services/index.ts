/**
 * server/services/index.ts
 *
 * Barrel export for all service modules.
 * Import from here to avoid referencing individual service files:
 *
 *   import { validateBookingCancellation } from "@/server/services";
 */

export * from "./booking.service";
