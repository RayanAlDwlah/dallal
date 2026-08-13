"use client";

import * as React from "react";

import { cn } from "@/lib/cn";

export interface FieldProps {
  label: string;
  /** Shown under the label, before any error. */
  hint?: string;
  /**
   * FR-CREATE-12 requires every failing field to be reported at once, so a
   * field owns its own error rather than deferring to a single form-level
   * summary.
   */
  error?: string;
  required?: boolean;
  className?: string;
  /** Receives the wiring a labelled, described, validated control needs. */
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": true | undefined;
    "aria-required": true | undefined;
  }) => React.ReactNode;
}

/**
 * Label + hint + error, wired for assistive technology.
 *
 * The control is passed as a render prop so the ids always match: a label
 * that is not actually associated with its input is the most common
 * accessibility defect in a form, and this shape makes it impossible.
 */
export function Field({
  label,
  hint,
  error,
  required = false,
  className,
  children,
}: FieldProps) {
  const id = React.useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
        {required ? (
          <span className="text-stop-text ms-1" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      {hint ? (
        <p id={hintId} className="text-ink-3 text-xs">
          {hint}
        </p>
      ) : null}

      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        "aria-required": required || undefined,
      })}

      {/*
        Error pairs a message with the red border — never colour alone
        (DESIGN_SYSTEM.md §8.1, NFR-USA-10).
      */}
      {error ? (
        <p id={errorId} role="alert" className="text-stop-text text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}
