"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { sendResetEmail } from "./actions";

const initialState = { error: undefined as string | undefined, sent: false };

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(sendResetEmail, initialState);

  if (state?.sent) {
    return (
      <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
        <p className="font-semibold">Check your email</p>
        <p className="mt-1 text-emerald-600">
          If an account exists for that address, we&apos;ve sent a password reset
          link. It expires in 1 hour.
        </p>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-5" action={formAction}>
      {state?.error && (
        <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {state.error}
        </div>
      )}

      <Input
        id="email"
        name="email"
        type="email"
        label="Email address"
        placeholder="you@example.com"
        autoComplete="email"
        required
      />

      <SubmitButton label="Send reset link" loadingLabel="Sending…" />
    </form>
  );
}
