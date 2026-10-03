import Link from "next/link";
import { CONTACT, LegalPage } from "@/components/app/legal";

export const metadata = { title: "Privacy policy" };

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy policy"
      intro="This explains what Setlo collects, why, and who can see it. Setlo is a prototype on test networks, and it collects only what it needs to run bookings."
      sections={[
        {
          h: "1. What we collect",
          p: [
            "Your email address, and the payout account (wallet address) created for it when you sign in.",
            "Booking details that agencies enter: package and supplier names, client and supplier emails, amounts, dates and shared terms, along with drafts and invitation links.",
            "Records of transactions Setlo relays for you and of emails it sends (recipient, type and subject), plus basic usage events such as a package being created or funded.",
            "Your IP address, used briefly for rate limiting to prevent abuse.",
            "On the demo page, your browser stores demo keys and progress locally. They are not sent to our database.",
          ],
        },
        {
          h: "2. How we use it",
          p: [
            "To sign you in, show you the bookings you are part of, relay your signed approvals, send invitations and payout notices by email, prevent abuse, and understand whether the prototype works. We don't sell your data or use it for advertising.",
          ],
        },
        {
          h: "3. Public blockchain data",
          p: [
            "Bookings are settled on public blockchains. Amounts, quotes, payout addresses and transfers are visible to anyone and cannot be deleted. Emails and names are kept off-chain.",
          ],
        },
        {
          h: "4. Who processes it",
          p: [
            "Privy (sign-in and payout accounts), Supabase (database), Vercel (hosting), QuickNode (blockchain access) and Google Gmail (sending emails). Each processes data only as needed to provide its service.",
          ],
        },
        {
          h: "5. Retention and your choices",
          p: [
            "Because this is a test prototype, data may be reset at any time. You can ask us to delete your off-chain data or ask what we hold about you by emailing " + CONTACT + ". Onchain records can't be removed.",
          ],
        },
        {
          h: "6. Changes",
          p: [
            "We may update this policy; the date above shows the latest version.",
            <>
              See also the <Link className="text-brand underline underline-offset-4" href="/terms">terms and conditions</Link>.
            </>,
          ],
        },
      ]}
    />
  );
}
