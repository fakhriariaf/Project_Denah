const { hashPassword } = require("better-auth/crypto");

async function run() {
  const hash = await hashPassword("password123");
  console.log("Hashed password:", hash);
}

run().catch(console.error);
