"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";

interface SubmitButtonProps {
  label: string;
  loadingLabel?: string;
}

/**
 * A submit button that automatically shows a loading state while the
 * parent Server Action is in-flight. Must be rendered inside a <form>.
 */
export function SubmitButton({ label, loadingLabel }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      size="lg"
      className="w-full"
      isLoading={pending}
      disabled={pending}
    >
      {pending ? (loadingLabel ?? label) : label}
    </Button>
  );
}
