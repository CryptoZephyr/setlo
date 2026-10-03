import { Suspense } from "react";
import { PageLoading } from "@/components/app/shell";
import { Wizard } from "@/components/booking/wizard";

export const metadata = { title: "New package" };

export default function Page() {
  return (
    <Suspense fallback={<PageLoading label="Loading" />}>
      <Wizard />
    </Suspense>
  );
}
