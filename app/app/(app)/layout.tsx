import { AppHeader } from "@/components/app/app-header";
import { Providers } from "@/components/app/providers";
import { RequireSession } from "@/components/app/session";
import { Footer } from "@/components/app/shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <RequireSession>
        <div className="flex min-h-dvh flex-col">
          <AppHeader />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
          <Footer />
        </div>
      </RequireSession>
    </Providers>
  );
}
