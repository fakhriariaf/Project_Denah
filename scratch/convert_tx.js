const fs = require("fs");
const path = require("path");

const files = [
  "server/actions/master.ts",
  "server/actions/marketing.ts",
  "server/actions/finance.ts",
  "server/actions/production.ts"
];

files.forEach(filePath => {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(absolutePath, "utf8");

  // 1. Replace `.all()[0]` with `.get()` (as a bridge)
  content = content.replace(/\.all\(\)\[0\]/g, ".get()");

  // 2. Convert transaction blocks to async/await
  // Match `db.transaction((tx) => {` or similar
  content = content.replace(/db\.transaction\(\(tx\)\s*=>\s*\{/g, "await db.transaction(async (tx) => {");
  content = content.replace(/db\.transaction\(async\s*\(tx\)\s*=>\s*\{/g, "await db.transaction(async (tx) => {");

  // 3. Prepend `await` to `tx.` select/insert/update/delete calls
  content = content.replace(/tx\.insert/g, "await tx.insert");
  content = content.replace(/tx\.update/g, "await tx.update");
  content = content.replace(/tx\.delete/g, "await tx.delete");
  content = content.replace(/tx\.select/g, "await tx.select");

  // 4. Clean up any duplicate `await await`
  content = content.replace(/await\s+await\s+/g, "await ");
  content = content.replace(/await\s+return\s+/g, "return await "); // keep return order correct if it happened

  fs.writeFileSync(absolutePath, content, "utf8");
  console.log(`Processed ${filePath}`);
});
