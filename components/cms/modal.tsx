"use client";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

import { useEffect, useRef, useState } from "react";
import type { Dialog } from "@/lib/cms/types";

export function Modal({
  value,
  onClose,
}: {
  value: Dialog;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    // showModal focuses the × button first; the operator is here to fill in the form.
    dialog?.querySelector<HTMLElement>("form input, form select")?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={value.title}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            onClose();
        }
      }}
    >
      <div className="panel-heading">
        <h2>{value.title}</h2>
        <button
          autoFocus
          className="close"
          aria-label="Close dialog"
          disabled={busy}
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {value.body}
      {value.fields && (
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setBusy(true);
            setError("");
            try {
              await value.submit?.(form);
              onClose();
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "Could not save. Try again.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {value.fields.map((field) => (
            <label key={field.name}>
              {field.label}
              {field.options ? (
                <select
                  name={field.name}
                  defaultValue={field.value}
                  disabled={busy}
                >
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  name={field.name}
                  type={field.type || "text"}
                  required={field.required}
                  defaultValue={field.value}
                  min={field.min}
                  max={field.max}
                  disabled={busy}
                />
              )}
            </label>
          ))}
          {value.secondary && (
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={async (event) => {
                const form = event.currentTarget.form;
                if (!form) return;
                setBusy(true);
                setError("");
                setNotice("");
                try {
                  await value.secondary?.run(new FormData(form));
                  setNotice("Code requested. Enter the code to sign in.");
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Could not request a code.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {value.secondary.label}
            </button>
          )}
          {notice && <p role="status">{notice}</p>}
          {error && (
            <p role="alert" className="inline-error">
              {error}
            </p>
          )}
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? "Saving…" : value.submitLabel || "Save"}
          </button>
        </form>
      )}
    </dialog>
  );
}
