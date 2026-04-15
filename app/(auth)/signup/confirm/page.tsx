import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Check your email" };

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-3xl">
            ✉️
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-gray-900">
          Check your email
        </h1>

        <p className="mt-3 text-sm text-gray-500">
          We sent a confirmation link to{" "}
          {email ? (
            <span className="font-medium text-gray-900">{email}</span>
          ) : (
            "your email address"
          )}
          . Click the link to activate your account.
        </p>

        <p className="mt-6 text-sm text-gray-400">
          Already confirmed?{" "}
          <Link
            href="/login"
            className="font-medium text-blue-600 hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
