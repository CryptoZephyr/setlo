import { TokenLanding } from "@/components/booking/token-landing";

export const metadata = { title: "Set up your payout account" };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <TokenLanding kind="setup" token={token} />;
}
