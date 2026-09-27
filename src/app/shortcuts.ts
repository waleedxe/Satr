import { COMMANDS, runCommand } from "./commands";
import { getActiveTab } from "../stores/documentsStore";

export const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

const KEY_NAMES: Record<string, string> = {
  " ": "Space",
  "+": "=",
  _: "-",
  "?": "/",
  "|": "\\",
  "<": ",",
  "!": "1",
  "@": "2",
  "#": "3",
  $: "4",
  "%": "5",
  "^": "6",
  "&": "7",
  "*": "8",
  "(": "9",
  ")": "0",
};

/** Normalizes a keyboard event to the "Mod+Shift+S" form used by commands. */
export function eventToShortcut(
  event: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">,
): string {
  const parts: string[] = [];
  const mod = IS_MAC ? event.metaKey : event.ctrlKey;
  if (mod) parts.push("Mod");
  // Ctrl on macOS (and Ctrl+Tab everywhere) is written explicitly.
  if (event.ctrlKey && IS_MAC) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  let key = event.key;
  // Digits with Shift report symbols; use the physical key instead.
  if (/^Digit\d$/.test(event.code)) key = event.code.slice(5);
  else key = KEY_NAMES[key] ?? key;
  if (key.length === 1) key = key.toUpperCase();
  parts.push(key);
  return parts.join("+");
}

/** Human-readable shortcut, e.g. "Ctrl+Shift+S" (or ⌘⇧S on macOS). */
export function formatShortcut(shortcut: string): string {
  if (!IS_MAC) return shortcut.replace("Mod", "Ctrl");
  return shortcut
    .replace("Mod+", "⌘")
    .replace("Ctrl+", "⌃")
    .replace("Alt+", "⌥")
    .replace("Shift+", "⇧");
}

function normalizeDefinition(shortcut: string): string {
  // "Ctrl+Tab" means the physical Ctrl key on every platform.
  return !IS_MAC ? shortcut.replace(/^Ctrl\+/, "Mod+") : shortcut;
}

const shortcutMap = new Map<string, string>();
for (const command of COMMANDS) {
  if (command.shortcut) shortcutMap.set(normalizeDefinition(command.shortcut), command.id);
}
// Common alternates.
shortcutMap.set("Mod+Shift+Z", "edit.redo");

/** Browser accelerators that make no sense in a desktop editor. */
const BLOCKED = new Set([
  "F5",
  "Mod+R",
  "Mod+Shift+R",
  "Mod+P",
  "Mod+U",
  "Mod+G",
  "Mod+Shift+G",
  "F7",
  "Mod+J",
]);

function isTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest(".ProseMirror, .cm-editor")) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function editorMode(target: EventTarget | null): "wysiwyg" | "source" | null {
  if (!(target instanceof HTMLElement)) return null;
  if (target.closest(".cm-editor")) return "source";
  if (target.closest(".ProseMirror")) return "wysiwyg";
  return null;
}

export function handleGlobalKeydown(event: KeyboardEvent): void {
  if (event.isComposing) return;
  const shortcut = eventToShortcut(event);
  if (BLOCKED.has(shortcut)) {
    event.preventDefault();
    return;
  }
  const id = shortcutMap.get(shortcut);
  if (!id) return;
  const command = COMMANDS.find((c) => c.id === id)!;
  const mode = editorMode(event.target);
  if (mode && command.nativeIn?.includes(mode)) return;
  // Inside a math/language input, let native text shortcuts through.
  if (command.scope === "editor" && isTextInput(event.target)) return;
  // Native-only shortcuts with focus outside the editor would do nothing useful.
  if (command.nativeIn && !mode && !getActiveTab()) return;
  event.preventDefault();
  event.stopPropagation();
  runCommand(id);
}

export function installGlobalShortcuts(): () => void {
  window.addEventListener("keydown", handleGlobalKeydown, true);
  return () => window.removeEventListener("keydown", handleGlobalKeydown, true);
}
