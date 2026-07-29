/**
 * Shared server-side type contracts.
 *
 * Additive module — does not replace or modify any existing file. Extracted
 * from the previously-private `DbOrTx` alias in `server/actions/marketing.ts`
 * so services (e.g. `server/services/kpr-sla/orchestrator.ts`) can accept
 * either the shared `db` instance or an in-flight Drizzle transaction without
 * redeclaring the same type in multiple places.
 *
 * See `.kiro/specs/kpr-stage-sla-master-data/design.md` > "Components and
 * Interfaces" > "1. Service Layer" > `orchestrator.ts` and Task 2.1 in
 * `tasks.md`.
 */

import { db } from "@/db";
import type { PgTransaction } from "drizzle-orm/pg-core";

/**
 * Type for functions that accept either the shared `db` instance or an
 * open Drizzle transaction (`tx`), allowing callers to compose atomic
 * multi-step writes without changing the function's public signature.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbOrTx = typeof db | PgTransaction<any, any, any>;
