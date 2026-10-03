import Link from "next/link";
import { CONTACT, LegalPage } from "@/components/app/legal";

export const metadata = { title: "Terms and conditions" };

export default function Terms() {
  return (
    <LegalPage
      title="Terms and conditions"
      intro="These terms cover your use of Setlo, a prototype for shared event bookings and conditional settlement. By signing in or using the demo, you agree to them."
      sections={[
        {
          h: "1. A prototype on test networks",
          p: [
            "Setlo currently runs only on test networks (Arbitrum Sepolia and Robinhood Chain Testnet) with test USDG. Test USDG has no monetary value and cannot be redeemed. Do not use Setlo for real bookings or real money.",
            "The service may change, reset, pause or stop at any time, and test data or balances may be lost.",
          ],
        },
        {
          h: "2. Accounts",
          p: [
            "You sign in with an email code. Setlo creates a payout account (a wallet address) linked to that email through our sign-in provider, Privy. You are responsible for keeping access to your email.",
            "Setlo checks that an invited person controls the invited email. It does not verify anyone's business identity, licences or ability to deliver an event. Clients should only approve suppliers they trust.",
          ],
        },
        {
          h: "3. How bookings and payments work",
          p: [
            "Bookings are settled by the SetloPackages smart contract. Its rules decide when deposits are released, when hold fees are earned, and when money is returned. Once a transaction is confirmed onchain, Setlo cannot reverse it.",
            "If a required supplier doesn't accept in time, or the package expires or is cancelled, the client gets the remaining funds back minus any hold fees they approved and that were earned. Setlo does not resolve disputes about the quality or delivery of an event.",
            "Paxos, the issuer of USDG, can pause the token or freeze addresses, including the Setlo contract. That could delay or block payments.",
          ],
        },
        {
          h: "4. Public blockchain data",
          p: [
            "Amounts, quotes, payout addresses and transaction history recorded onchain are public and permanent. Don't put information in a booking that you aren't comfortable being public.",
          ],
        },
        {
          h: "5. Acceptable use",
          p: [
            "Don't use Setlo to break the law, impersonate others, send spam through invitations, abuse the test faucets or interfere with the service. We may limit or remove access that does.",
          ],
        },
        {
          h: "6. No warranty and limited liability",
          p: [
            "Setlo is provided as is, without warranties of any kind. Smart contracts, wallets, networks and third-party services can fail. To the extent the law allows, Setlo and its builders are not liable for losses arising from your use of the prototype.",
          ],
        },
        {
          h: "7. Changes and contact",
          p: [
            "We may update these terms; the date above shows the latest version. Questions: " + CONTACT + ".",
            <>
              See also the <Link className="text-brand underline underline-offset-4" href="/privacy">privacy policy</Link>.
            </>,
          ],
        },
      ]}
    />
  );
}
