"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { signup } from "./actions";

const initialState = { error: undefined as string | undefined };

export function SignupForm() {
  const [state, formAction] = useActionState(signup, initialState);

  return (
    <form className="flex flex-col gap-5" action={formAction}>
      {state?.error && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600"
        >
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Input
          id="first-name"
          name="firstName"
          type="text"
          label="First name"
          placeholder="Jane"
          autoComplete="given-name"
          required
        />
        <Input
          id="last-name"
          name="lastName"
          type="text"
          label="Last name"
          placeholder="Smith"
          autoComplete="family-name"
          required
        />
      </div>

      <Input
        id="email"
        name="email"
        type="email"
        label="Email address"
        placeholder="you@example.com"
        autoComplete="email"
        required
      />

      <Input
        id="password"
        name="password"
        type="password"
        label="Password"
        placeholder="Min. 8 characters"
        autoComplete="new-password"
        required
        minLength={8}
      />

      <SubmitButton label="Create account" loadingLabel="Creating account…" />

      <p className="text-center text-xs text-gray-400">
        By signing up, you agree to our{" "}
        <Link href="#" className="underline hover:text-gray-600">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="#" className="underline hover:text-gray-600">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}
