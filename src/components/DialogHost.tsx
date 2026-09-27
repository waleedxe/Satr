import { useEffect, useRef, useState } from "react";

import { useT } from "../i18n";
import { useUi } from "../stores/uiStore";

/** Renders the modal dialog requested through useUi().showDialog. */
export function DialogHost() {
  const dialog = useUi((s) => s.dialog);
  const resolve = useUi((s) => s.resolveDialog);
  const [values, setValues] = useState<Record<string, string>>({});
  const boxRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const t = useT();

  useEffect(() => {
    if (!dialog) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    setValues(Object.fromEntries((dialog.fields ?? []).map((f) => [f.id, f.value])));
    requestAnimationFrame(() => {
      const box = boxRef.current;
      const target =
        box?.querySelector<HTMLElement>("input") ??
        box?.querySelector<HTMLElement>(".button-primary");
      target?.focus();
    });
    return () => previousFocus.current?.focus?.();
  }, [dialog]);

  if (!dialog) return null;

  const answer = (button: string) => resolve({ button, values });
  const primary = dialog.buttons.find((b) => b.variant === "primary")?.id ?? dialog.buttons[0]?.id;

  return (
    <div className="modal-backdrop" onMouseDown={() => answer(dialog.cancelId)}>
      <div
        ref={boxRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            answer(dialog.cancelId);
          } else if (
            e.key === "Enter" &&
            primary &&
            (e.target as HTMLElement).tagName === "INPUT"
          ) {
            e.preventDefault();
            answer(primary);
          } else if (e.key === "Tab") {
            // Keep focus inside the dialog.
            const focusable = [
              ...(boxRef.current?.querySelectorAll<HTMLElement>("input, button") ?? []),
            ];
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <h2 id="dialog-title" className="modal-title">
          {dialog.title}
        </h2>
        {dialog.message && <p className="modal-message">{dialog.message}</p>}
        {dialog.fields?.map((field) => (
          <label key={field.id} className="field">
            <span className="field-label">{field.label}</span>
            <span className="field-row">
              <input
                type="text"
                className="field-input"
                value={values[field.id] ?? ""}
                placeholder={field.placeholder}
                spellCheck={false}
                onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
              />
              {field.browse && (
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    void field.browse!().then((value) => {
                      if (value !== null) setValues((v) => ({ ...v, [field.id]: value }));
                    });
                  }}
                >
                  {t("dialog.browse")}
                </button>
              )}
            </span>
          </label>
        ))}
        <div className="modal-actions">
          {dialog.buttons.map((button) => (
            <button
              key={button.id}
              type="button"
              className={`button${button.variant === "primary" ? " button-primary" : ""}${button.variant === "danger" ? " button-danger" : ""}`}
              onClick={() => answer(button.id)}
            >
              {button.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
