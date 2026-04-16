import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
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
          <h1 className="text-xl font-bold text-gray-900">Reset your password</h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Enter your email and we&apos;ll send you a link to set a new password.
          </p>

          <div className="mt-6">
            <ForgotPasswordForm />
          </div>

          <p className="mt-6 text-center text-sm text-gray-500">
            <Link href="/login" className="font-medium text-blue-600 hover:underline">
              Back to log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
