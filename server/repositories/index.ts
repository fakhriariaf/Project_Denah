/**
 * server/repositories/index.ts
 *
 * Barrel export for all repository modules.
 * Import from here to avoid referencing individual repo files:
 *
 *   import { getBookingById, getAccountById } from "@/server/repositories";
 */

export * from "./booking.repo";
export * from "./chat.repo";
export * from "./finance.repo";
export * from "./production.repo";
