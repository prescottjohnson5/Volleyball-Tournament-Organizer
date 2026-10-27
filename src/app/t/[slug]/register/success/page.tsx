import type { Metadata } from "next";
import { ClaimCaptainLink } from "./ClaimCaptainLink";

export const metadata: Metadata = { title: "Registration complete" };
export const dynamic = "force-dynamic";

export default async function RegistrationSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { slug } = await params;
  const { session_id: sessionId } = await searchParams;
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Thanks for registering</h1>
      {sessionId ? (
        <ClaimCaptainLink sessionId={sessionId} slug={slug} />
      ) : (
        <p className="card">This page needs the link Stripe redirected you to after paying.</p>
      )}
    </div>
  );
}
