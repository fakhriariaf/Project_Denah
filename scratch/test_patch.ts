import * as pgCore from "drizzle-orm/pg-core";

console.log("Exports in drizzle-orm/pg-core:");
const keys = Object.keys(pgCore);
console.log("Found", keys.length, "exports.");

// Check if PgDelete, PgUpdate, PgInsert, PgSelect or their base classes exist
const classesToFind = ["PgDelete", "PgDeleteBase", "PgUpdate", "PgUpdateBase", "PgInsert", "PgInsertBase", "PgSelect", "PgSelectBase"];
classesToFind.forEach(cls => {
  console.log(`${cls} exists:`, !!(pgCore as any)[cls]);
});
