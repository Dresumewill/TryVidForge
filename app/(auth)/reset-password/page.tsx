import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Set new password" };

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-gray-50 px-4 py-12 sm:px-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-bold text-blue-600 tracking-tight">
            VidForge
          </Link>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-bold text-gray-900">Set a new password</h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Choose a strong password for your account.
          </p>

          <div className="mt-6">
            <ResetPasswordForm />
          </div>
        </div>
      </div>
    </div>
  );
}
