"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { login } from "./actions";

interface LoginFormProps {
  next?: string;
}

const initialState = { error: undefined as string | undefined };

export function LoginForm({ next }: LoginFormProps) {
  const [state, formAction] = useActionState(login, initialState);

  return (
    <form className="flex flex-col gap-5" action={formAction}>
      {/* Pass ?next through the form so the action can redirect correctly */}
      {next && <input type="hidden" name="next" value={next} />}

      {state?.error && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600"
        >
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

      <div className="flex flex-col gap-1.5">
        <Input
          id="password"
          name="password"
          type="password"
          label="Password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
        <div className="text-right">
          <Link href="#" className="text-xs text-blue-600 hover:underline">
            Forgot password?
          </Link>
        </div>
      </div>

      <SubmitButton label="Log in" loadingLabel="Logging in…" />
    </form>
  );
}
