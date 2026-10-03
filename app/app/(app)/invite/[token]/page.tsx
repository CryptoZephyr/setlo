import { TokenLanding } from "@/components/booking/token-landing";

export const metadata = { title: "Invitation" };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <TokenLanding kind="invite" token={token} />;
}
