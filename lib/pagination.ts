// lib/pagination.ts
// Server-side pagination utilities for offset-based and cursor-based pagination

/**
 * Parameters for offset-based pagination (standard pages).
 */
export interface PaginationParams {
  page: number;      // 1-based page number
  pageSize: number;  // Number of records per page, default: 20
}

/**
 * Result type for offset-based paginated queries.
 */
export interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Parameters for cursor-based pagination (used for Audit Log).
 */
export interface CursorPaginationParams {
  cursor?: string;   // ISO timestamp string
  pageSize: number;  // Number of records per page, default: 100
}

/**
 * Result type for cursor-based paginated queries.
 */
export interface CursorPaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Calculate the SQL LIMIT and OFFSET from pagination params.
 * offset = (page - 1) * pageSize, limit = pageSize
 */
export function calculateOffset(params: PaginationParams): { limit: number; offset: number } {
  const page = params.page;
  const pageSize = params.pageSize;

  const offset = (page - 1) * pageSize;
  const limit = pageSize;

  return { limit, offset };
}

/**
 * Validate and normalize pagination parameters.
 * - If pageSize < 1, defaults to 20
 * - If page < 1, returns page = 1 (first page fallback)
 * - If page > totalPages, returns page = 1 (first page fallback)
 * BUG 14 FIX: Explicit guard for totalCount = 0 avoids ambiguous comparison page > 0
 */
export function validatePaginationParams(
  params: PaginationParams,
  totalCount: number
): PaginationParams {
  // Normalize pageSize: if less than 1, default to 20
  const pageSize = params.pageSize < 1 ? 20 : params.pageSize;

  // Short-circuit: no data — always return first page
  if (totalCount === 0) {
    return { page: 1, pageSize };
  }

  // Calculate total pages
  const totalPages = Math.ceil(totalCount / pageSize);

  // Normalize page: if less than 1 or greater than totalPages, fallback to page 1
  let page = params.page;
  if (page < 1 || page > totalPages) {
    page = 1;
  }

  return { page, pageSize };
}
