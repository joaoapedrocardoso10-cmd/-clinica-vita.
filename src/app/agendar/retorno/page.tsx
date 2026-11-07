import PaymentReturn from "./payment-return";

export const instant = false;

export default async function PaymentReturnPage({ searchParams }: { searchParams: Promise<{ appointment?: string }> }) {
  const params = await searchParams;
  return <PaymentReturn appointmentId={params.appointment ?? ""} />;
}
