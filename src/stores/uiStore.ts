import { create } from "zustand";

import { t } from "../i18n";

export interface DialogButton {
  id: string;
  label: string;
  variant?: "primary" | "danger" | "default";
}

export interface DialogField {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  /** Optional "Browse…" action that returns a new value. */
  browse?: () => Promise<string | null>;
}

export interface DialogRequest {
  title: string;
  message?: string;
  buttons: DialogButton[];
  fields?: DialogField[];
  /** Button used for Escape / clicking outside. */
  cancelId: string;
}

export interface DialogResult {
  button: string;
  values: Record<string, string>;
}

export interface Toast {
  id: number;
  message: string;
  kind: "info" | "success" | "error";
}

export type Panel = null | "settings" | "shortcuts" | "about";

interface UiState {
  dialog: (DialogRequest & { resolve: (r: DialogResult) => void }) | null;
  toasts: Toast[];
  findOpen: boolean;
  replaceOpen: boolean;
  panel: Panel;
  loading: string | null;
  showDialog(request: DialogRequest): Promise<DialogResult>;
  resolveDialog(result: DialogResult): void;
  toast(message: string, kind?: Toast["kind"]): void;
  dismissToast(id: number): void;
  setFind(open: boolean, replace?: boolean): void;
  setPanel(panel: Panel): void;
  setLoading(message: string | null): void;
}

let toastId = 0;
const dialogQueue: (DialogRequest & { resolve: (r: DialogResult) => void })[] = [];

export const useUi = create<UiState>((set, get) => ({
  dialog: null,
  toasts: [],
  findOpen: false,
  replaceOpen: false,
  panel: null,
  loading: null,

  showDialog(request) {
    return new Promise<DialogResult>((resolve) => {
      const entry = { ...request, resolve };
      if (get().dialog) dialogQueue.push(entry);
      else set({ dialog: entry });
    });
  },

  resolveDialog(result) {
    const current = get().dialog;
    if (!current) return;
    set({ dialog: dialogQueue.shift() ?? null });
    current.resolve(result);
  },

  toast(message, kind = "info") {
    const id = ++toastId;
    set((state) => ({ toasts: [...state.toasts.slice(-3), { id, message, kind }] }));
    setTimeout(() => get().dismissToast(id), kind === "error" ? 7000 : 3500);
  },

  dismissToast(id) {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  setFind(open, replace = false) {
    set({ findOpen: open, replaceOpen: open && replace });
  },

  setPanel(panel) {
    set({ panel });
  },

  setLoading(message) {
    set({ loading: message });
  },
}));

/** Save / Don't Save / Cancel prompt for a document with unsaved changes. */
export async function confirmUnsaved(title: string): Promise<"save" | "discard" | "cancel"> {
  const result = await useUi.getState().showDialog({
    title: t("unsaved.title"),
    message: t("unsaved.message", { title }),
    buttons: [
      { id: "save", label: t("unsaved.save"), variant: "primary" },
      { id: "discard", label: t("unsaved.discard"), variant: "danger" },
      { id: "cancel", label: t("dialog.cancel") },
    ],
    cancelId: "cancel",
  });
  return result.button as "save" | "discard" | "cancel";
}
