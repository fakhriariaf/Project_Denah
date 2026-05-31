const Database = require("better-sqlite3");
const path = require("path");

function check() {
  console.log("Analyzing SQLite database...");
  const dbPath = path.join(__dirname, "../local.db");
  const db = new Database(dbPath);

  try {
    const projects = db.prepare("SELECT id, name, code FROM projects").all();
    console.log("Projects:", JSON.stringify(projects, null, 2));

    const units = db.prepare("SELECT id, code, project_id, status FROM units").all();
    console.log("Units:", JSON.stringify(units, null, 2));

    const users = db.prepare("SELECT id, name, email, role_id FROM user").all();
    console.log("Users:", JSON.stringify(users, null, 2));

    const roles = db.prepare("SELECT id, name FROM roles").all();
    console.log("Roles:", JSON.stringify(roles, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    db.close();
  }
}

check();
