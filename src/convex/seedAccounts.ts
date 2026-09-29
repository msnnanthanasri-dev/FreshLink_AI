import { internalMutation } from "./_generated/server";
import { Scrypt } from "lucia";

/**
 * Runs AFTER seedInternal: links password credentials (authAccounts) to the
 * seeded demo users so their logins work with the standard password provider.
 *
 * authAccounts schema (from @convex-dev/auth):
 *   { userId, provider, providerAccountId, secret, emailVerified?, phoneVerified? }
 * Indexes: userIdAndProvider, providerAndAccountId.
 */
export const seedAccountsInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const passwordHash = await new Scrypt().hash("freshlink123");
    const users = await ctx.db.query("users").collect();
    let created = 0;
    for (const u of users) {
      const email = u.email;
      if (!email || u.isAnonymous) continue;
      const existing = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", u._id).eq("provider", "password"))
        .collect();
      if (existing.length > 0) continue;
      const sameEmail = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) => q.eq("provider", "password").eq("providerAccountId", email))
        .collect();
      if (sameEmail.length > 0) continue;
      await ctx.db.insert("authAccounts", {
        userId: u._id,
        provider: "password",
        providerAccountId: email,
        secret: passwordHash,
      });
      created++;
    }
    return { created };
  },
});
