import { requireUser } from "@/lib/auth";
import { handler } from "@/lib/http";

/** Verifies the Privy session and stores the profile (email + embedded wallet). */
export const POST = handler(async (req) => {
  const user = await requireUser(req);
  return { email: user.email, wallet: user.wallet };
});
