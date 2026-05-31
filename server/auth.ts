import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db, schema } from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { eq } from "drizzle-orm";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  user: {
    additionalFields: {
      roleId: {
        type: "string",
        required: false,
        input: false,
      },
      status: {
        type: "string",
        required: false,
      }
    }
  },
  hooks: {
    before: async (context: any) => {
      if (context.path === "/sign-in/email") {
        const email = context.body?.email;
        if (!email) return;
        const [foundUser] = await db
          .select({ status: userTable.status })
          .from(userTable)
          .where(eq(userTable.email, email.toLowerCase()))
          .limit(1);
        if (foundUser && foundUser.status !== "active") {
          throw new Error("Akun Anda telah dinonaktifkan. Hubungi Admin untuk mengaktifkan kembali.");
        }
      }
    },
  },
});
