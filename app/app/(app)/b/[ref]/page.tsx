import { BookingPage } from "@/components/booking/booking-page";

export const metadata = { title: "Booking" };

export default async function Page({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  return <BookingPage bookingRef={ref} />;
}
