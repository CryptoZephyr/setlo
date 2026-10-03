import { Suspense } from "react";
import { Providers } from "@/components/app/providers";
import { PageLoading } from "@/components/app/shell";
import { SignIn } from "./sign-in";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <Providers>
      <Suspense fallback={<PageLoading label="Loading" />}>
        <SignIn />
      </Suspense>
    </Providers>
  );
}
