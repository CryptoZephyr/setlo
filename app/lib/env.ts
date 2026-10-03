import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_PRIVY_APP_ID: z.string().min(1),
  PRIVY_APP_SECRET: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  RELAYER_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  ARB_SEPOLIA_RPC_URL: z.string().url(),
  ROBINHOOD_RPC_URL: z.string().url(),
  QUICKNODE_WEBHOOK_SECRET: z.string().min(1),
  GMAIL_USER: z.string().email(),
  GMAIL_APP_PASSWORD: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

/** Server-only configuration, validated on first use so builds don't need secrets. */
export function env(): ServerEnv {
  cached ??= schema.parse(process.env);
  return cached;
}
