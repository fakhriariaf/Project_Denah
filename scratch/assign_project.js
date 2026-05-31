const Database = require("better-sqlite3");
const path = require("path");

function run() {
  console.log("Assigning supervisor to project...");
  const dbPath = path.join(__dirname, "../local.db");
  const db = new Database(dbPath);

  try {
    const supervisorId = "brN7nXHLly5NrOgTWqUmQKw2fv1zuLkL"; // Pengawas Ucup
    const projectId = "f7406b1b-28a7-4efc-b28f-0d712c816b74"; // Perumahan Sederhana

    // Insert assignment
    const id = require("crypto").randomUUID();
    const stmt = db.prepare("INSERT INTO project_users (id, user_id, project_id, created_at) VALUES (?, ?, ?, ?)");
    stmt.run(id, supervisorId, projectId, Date.now());
    
    console.log("Successfully assigned supervisor to project!");

    // Verify
    const projectUsers = db.prepare("SELECT * FROM project_users").all();
    console.log("Total project_users:", projectUsers.length);
    console.log(JSON.stringify(projectUsers, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    db.close();
  }
}

run();
