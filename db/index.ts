import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { PgDeleteBase, PgUpdateBase, PgInsertBase, PgSelectBase } from 'drizzle-orm/pg-core';

// Monkey-patch Drizzle pg-core builders to support SQLite syntax bridge
(PgDeleteBase.prototype as any).run = function () {
  return this;
};
(PgUpdateBase.prototype as any).run = function () {
  return this;
};
(PgInsertBase.prototype as any).run = function () {
  return this;
};
(PgSelectBase.prototype as any).all = function () {
  return this;
};
(PgSelectBase.prototype as any).get = async function () {
  const res = await this;
  return res[0];
};

import * as authSchema from './schema/auth';
import * as accessSchema from './schema/access';
import * as systemSchema from './schema/system';
import * as masterSchema from './schema/master';
import * as marketingSchema from './schema/marketing';
import * as financeSchema from './schema/finance';
import * as productionSchema from './schema/production';
import * as chatSchema from './schema/chat';

export const schema = {
  ...authSchema,
  ...accessSchema,
  ...systemSchema,
  ...masterSchema,
  ...marketingSchema,
  ...financeSchema,
  ...productionSchema,
  ...chatSchema,
};

let connectionString = process.env.DATABASE_URL || '';
if (!connectionString.startsWith('postgres://') && !connectionString.startsWith('postgresql://')) {
  // BUG 3 FIX: Warn clearly when DATABASE_URL is missing or not a valid PostgreSQL URL.
  // This prevents silent fallback to localhost:5432 which fails without a clear error message.
  const isLocalFallback = !connectionString || connectionString === 'local.db';
  if (process.env.NODE_ENV !== 'test') {
    console.warn(
      '[db] WARNING: DATABASE_URL is not set or is not a valid PostgreSQL connection string.' +
      ' Falling back to postgres://postgres:postgres@localhost:5432/postgres.' +
      ' Ensure PostgreSQL is running locally or set DATABASE_URL to a valid Supabase/PostgreSQL URI.'
    );
  }
  connectionString = 'postgres://postgres:postgres@localhost:5432/postgres';
}

declare global {
  // eslint-disable-next-line no-var
  var globalClient: any;
}

let client: any;

if (process.env.NODE_ENV === 'production') {
  client = postgres(connectionString, { prepare: false });
} else {
  if (!globalThis.globalClient) {
    globalThis.globalClient = postgres(connectionString, { prepare: false });
  }
  client = globalThis.globalClient;
}

export const db = drizzle(client, { schema });
