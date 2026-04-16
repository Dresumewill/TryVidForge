"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { updatePassword } from "./actions";

const initialState = { error: undefined as string | undefined };

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(updatePassword, initialState);

  return (
    <form className="flex flex-col gap-5" action={formAction}>
      {state?.error && (
        <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {state.error}
        </div>
      )}

      <Input
        id="password"
        name="password"
        type="password"
        label="New password"
        placeholder="Min. 8 characters"
        autoComplete="new-password"
        required
        minLength={8}
      />

      <Input
        id="confirmPassword"
        name="confirmPassword"
        type="password"
        label="Confirm new password"
        placeholder="Repeat your password"
        autoComplete="new-password"
        required
      />

      <SubmitButton label="Update password" loadingLabel="Updating…" />
    </form>
  );
}
