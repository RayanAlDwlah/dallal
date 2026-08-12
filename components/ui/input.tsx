import * as React from "react";

import { cn } from "@/lib/cn";

const base = [
  "w-full rounded-md border bg-surface text-ink",
  "px-3 min-h-tap text-base",
  "placeholder:text-ink-3",
  "transition-colors duration-[120ms]",
  "disabled:cursor-not-allowed disabled:opacity-45 disabled:bg-sunk",
].join(" ");

function toneFor(invalid: boolean | undefined) {
  return invalid
    ? "border-stop hover:border-stop-hover"
    : "border-rule-strong hover:border-ink-3";
}

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(base, toneFor(props["aria-invalid"] === true), className)}
        {...props}
      />
    );
  },
);

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, rows = 5, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(base, "min-h-32 py-2.5", toneFor(props["aria-invalid"] === true), className)}
        {...props}
      />
    );
  },
);
