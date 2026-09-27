import type { EditorView } from "@codemirror/view";
import type { Editor } from "@tiptap/core";
import { selectedRect, isInTable } from "@tiptap/pm/tables";

import { insertText, setLinePrefix, toggleWrap } from "../editor/source/sourceCommands";
import { editorRegistry } from "../features/files/editorRegistry";
import {
  browseForImage,
  closeDocument,
  newDocument,
  openDocumentsDialog,
  openFolderDialog,
  saveDocument,
  saveDocumentAs,
  switchMode,
} from "../features/files/fileActions";
import { t } from "../i18n";
import { bridge } from "../native";
import { getActiveTab, useDocuments } from "../stores/documentsStore";
import { useSettings } from "../stores/settingsStore";
import { useUi } from "../stores/uiStore";

export type CommandScope = "app" | "editor";

export interface Command {
  id: string;
  label: string;
  /** e.g. "Mod+Shift+S"; Mod is Ctrl on Windows/Linux and Cmd on macOS. */
  shortcut?: string;
  /**
   * The editor itself already handles this shortcut in the given mode, so
   * the global key handler must not intercept it there.
   */
  nativeIn?: ("wysiwyg" | "source")[];
  /** "editor" commands are ignored while typing in dialogs and inputs. */
  scope: CommandScope;
  run(): void | Promise<unknown>;
  enabled?(): boolean;
  checked?(): boolean;
}

function activeHandle() {
  const tab = getActiveTab();
  return tab ? editorRegistry.get(tab.id) : undefined;
}

function wysiwyg(): Editor | null {
  const editor = activeHandle()?.editor ?? null;
  return editor && !editor.isDestroyed ? editor : null;
}

function source(): EditorView | null {
  return activeHandle()?.sourceView ?? null;
}

const hasDocument = () => Boolean(getActiveTab());
const inWysiwyg = () => wysiwyg() !== null;

/** Runs `visual` in WYSIWYG mode or `raw` in source mode. */
function edit(visual: (e: Editor) => unknown, raw?: (v: EditorView) => unknown): () => void {
  return () => {
    const editor = wysiwyg();
    if (editor) {
      visual(editor);
      return;
    }
    const view = source();
    if (view && raw) raw(view);
  };
}

async function promptLink(): Promise<void> {
  const editor = wysiwyg();
  const view = source();
  if (!editor && !view) return;
  const currentHref = editor ? String(editor.getAttributes("link").href ?? "") : "";
  const emptySelection = editor ? editor.state.selection.empty : view!.state.selection.main.empty;
  const fields = [
    { id: "href", label: t("link.url"), value: currentHref, placeholder: "https://" },
  ];
  if (emptySelection && !currentHref)
    fields.unshift({
      id: "text",
      label: t("link.text"),
      value: "",
      placeholder: t("link.textPlaceholder"),
    });
  const result = await useUi.getState().showDialog({
    title: currentHref ? t("link.edit") : t("link.insert"),
    fields,
    buttons: [
      { id: "ok", label: currentHref ? t("link.update") : t("dialog.insert"), variant: "primary" },
      ...(currentHref
        ? [{ id: "remove", label: t("link.remove"), variant: "danger" as const }]
        : []),
      { id: "cancel", label: t("dialog.cancel") },
    ],
    cancelId: "cancel",
  });
  const href = (result.values.href ?? "").trim();
  const text = (result.values.text ?? "").trim() || href;
  if (editor) {
    const chain = editor.chain().focus();
    if (result.button === "remove" || (result.button === "ok" && !href)) {
      chain.extendMarkRange("link").unsetLink().run();
    } else if (result.button === "ok") {
      if (emptySelection && !currentHref) {
        chain
          .insertContent({ type: "text", text, marks: [{ type: "link", attrs: { href } }] })
          .run();
      } else {
        chain.extendMarkRange("link").setLink({ href }).run();
      }
    }
    return;
  }
  if (view && result.button === "ok" && href) {
    const sel = view.state.selection.main;
    const label = sel.empty ? text : view.state.sliceDoc(sel.from, sel.to);
    insertText(view, `[${label}](${href})`);
  }
}

async function promptImage(): Promise<void> {
  const editor = wysiwyg();
  const view = source();
  if (!editor && !view) return;
  const docPath = getActiveTab()?.path ?? null;
  const result = await useUi.getState().showDialog({
    title: t("image.title"),
    message: docPath ? undefined : t("image.tip"),
    fields: [
      {
        id: "src",
        label: t("image.src"),
        value: "",
        placeholder: t("image.srcPlaceholder"),
        browse: bridge().isDesktop ? () => browseForImage(docPath) : undefined,
      },
      { id: "alt", label: t("image.alt"), value: "" },
    ],
    buttons: [
      { id: "ok", label: t("dialog.insert"), variant: "primary" },
      { id: "cancel", label: t("dialog.cancel") },
    ],
    cancelId: "cancel",
  });
  const src = (result.values.src ?? "").trim();
  const alt = (result.values.alt ?? "").trim();
  if (result.button !== "ok" || !src) return;
  if (editor) {
    editor.chain().focus().insertContent({ type: "image", attrs: { src, alt } }).run();
  } else if (view) {
    insertText(view, `![${alt}](${src.includes(" ") ? `<${src}>` : src})`);
  }
}

function alignColumn(editor: Editor, align: "left" | "center" | "right" | null): boolean {
  const { state } = editor;
  if (!isInTable(state)) return false;
  const rect = selectedRect(state);
  const tr = state.tr;
  for (let col = rect.left; col < rect.right; col++) {
    for (let row = 0; row < rect.map.height; row++) {
      const cellPos = rect.map.map[row * rect.map.width + col];
      if (cellPos === undefined) continue;
      const cell = rect.table.nodeAt(cellPos);
      if (cell) tr.setNodeMarkup(rect.tableStart + cellPos, null, { ...cell.attrs, align });
    }
  }
  editor.view.dispatch(tr);
  return true;
}

const TABLE_TEMPLATE =
  "\n| Column 1 | Column 2 | Column 3 |\n| -------- | -------- | -------- |\n|          |          |          |\n";

function cycleTab(step: number) {
  const { tabs, activeId, setActive } = useDocuments.getState();
  if (tabs.length < 2) return;
  const index = tabs.findIndex((t) => t.id === activeId);
  const next = tabs[(index + step + tabs.length) % tabs.length];
  if (next) setActive(next.id);
}

function toggleSetting(
  key: "focusMode" | "typewriterMode" | "sidebarVisible" | "autosave" | "spellcheck",
) {
  const settings = useSettings.getState();
  settings.update({ [key]: !settings[key] });
}

const heading = (level: number): Command => ({
  id: `para.h${level}`,
  label: `Heading ${level}`,
  shortcut: `Mod+${level}`,
  scope: "editor",
  enabled: hasDocument,
  run: edit(
    (e) =>
      e
        .chain()
        .focus()
        .toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 })
        .run(),
    (v) => setLinePrefix(v, `${"#".repeat(level)} `),
  ),
  checked: () => Boolean(wysiwyg()?.isActive("heading", { level })),
});

export const COMMANDS: Command[] = [
  // File
  {
    id: "file.new",
    label: "New",
    shortcut: "Mod+N",
    scope: "app",
    run: () => {
      newDocument();
    },
  },
  {
    id: "file.open",
    label: "Open…",
    shortcut: "Mod+O",
    scope: "app",
    run: () => openDocumentsDialog(),
  },
  { id: "file.openFolder", label: "Open Folder…", scope: "app", run: () => openFolderDialog() },
  {
    id: "file.save",
    label: "Save",
    shortcut: "Mod+S",
    scope: "app",
    enabled: hasDocument,
    run: () => {
      const tab = getActiveTab();
      return tab ? saveDocument(tab.id) : undefined;
    },
  },
  {
    id: "file.saveAs",
    label: "Save As…",
    shortcut: "Mod+Shift+S",
    scope: "app",
    enabled: hasDocument,
    run: () => {
      const tab = getActiveTab();
      return tab ? saveDocumentAs(tab.id) : undefined;
    },
  },
  {
    id: "file.close",
    label: "Close Tab",
    shortcut: "Mod+W",
    scope: "app",
    enabled: hasDocument,
    run: () => {
      const tab = getActiveTab();
      return tab ? closeDocument(tab.id) : undefined;
    },
  },
  {
    id: "app.quit",
    label: "Exit",
    shortcut: "Mod+Q",
    scope: "app",
    run: () => bridge().closeWindow(),
  },

  // Edit
  {
    id: "edit.undo",
    label: "Undo",
    shortcut: "Mod+Z",
    nativeIn: ["wysiwyg", "source"],
    scope: "editor",
    enabled: hasDocument,
    run: edit(
      (e) => e.chain().focus().undo().run(),
      (v) => import("@codemirror/commands").then((m) => m.undo(v)),
    ),
  },
  {
    id: "edit.redo",
    label: "Redo",
    shortcut: "Mod+Y",
    nativeIn: ["wysiwyg", "source"],
    scope: "editor",
    enabled: hasDocument,
    run: edit(
      (e) => e.chain().focus().redo().run(),
      (v) => import("@codemirror/commands").then((m) => m.redo(v)),
    ),
  },
  {
    id: "edit.selectAll",
    label: "Select All",
    shortcut: "Mod+A",
    nativeIn: ["wysiwyg", "source"],
    scope: "editor",
    enabled: hasDocument,
    run: edit(
      (e) => e.chain().focus().selectAll().run(),
      (v) => v.dispatch({ selection: { anchor: 0, head: v.state.doc.length } }),
    ),
  },
  {
    id: "edit.find",
    label: "Find",
    shortcut: "Mod+F",
    scope: "app",
    enabled: hasDocument,
    run: () => useUi.getState().setFind(true, useUi.getState().replaceOpen),
  },
  {
    id: "edit.replace",
    label: "Replace",
    shortcut: "Mod+H",
    scope: "app",
    enabled: hasDocument,
    run: () => useUi.getState().setFind(true, true),
  },

  // Paragraph
  heading(1),
  heading(2),
  heading(3),
  heading(4),
  heading(5),
  heading(6),
  {
    id: "para.paragraph",
    label: "Paragraph",
    shortcut: "Mod+0",
    scope: "editor",
    enabled: hasDocument,
    run: edit(
      (e) => e.chain().focus().setParagraph().run(),
      (v) => setLinePrefix(v, ""),
    ),
  },
  {
    id: "para.quote",
    label: "Quote",
    shortcut: "Mod+Shift+B",
    nativeIn: ["wysiwyg"],
    scope: "editor",
    enabled: hasDocument,
    run: edit(
      (e) => e.chain().focus().toggleBlockquote().run(),
      (v) => setLinePrefix(v, "> "),
    ),
  },
  {
    id: "para.bulletList",
    label: "Bulleted List",
    shortcut: "Mod+Shift+8",
    nativeIn: ["wysiwyg"],
    scope: "editor",
    enabled: hasDocument,
    run: edit(
      (e) => e.chain().focus().toggleBulletList().run(),
      (v) => setLinePrefix(v, "- "),
    ),
  },
  {
    id: "para.orderedList",
    label: "Numbered List",
    shortcut: "Mod+Shift+7",
    nativeIn: ["wysiwyg"],
    scope: "editor",
    enabled: hasDocument,
    run: edit(
      (e) => e.chain().focus().toggleOrderedList().run(),
      (v) => setLinePrefix(v, "1. "),
    ),
  },
  {
    id: "para.taskList",
    label: "Task List",
    shortcut: "Mod+Shift+9",
    nativeIn: ["wysiwyg"],
    scope: "editor",
    enabled: hasDocument,
    run: edit(
      (e) => e.chain().focus().toggleTaskList().run(),
      (v) => setLinePrefix(v, "- [ ] "),
    ),
  },
  {
    id: "para.codeBlock",
    label: "Code Block",
    shortcut: "Mod+Alt+C",
    nativeIn: ["wysiwyg"],
    scope: "editor",
    enabled: hasDocument,
    run: edit(
      (e) => e.chain().focus().toggleCodeBlock().run(),
      (v) => toggleWrap(v, "```\n", "\n```"),
    ),
  },
  {
    id: "para.mathBlock",
    label: "Math Block",
    shortcut: "Mod+Shift+M",
    scope: "editor",
    enabled: hasDocument,
    run: edit(
      (e) => e.chain().focus().insertMathBlock().run(),
      (v) => insertText(v, "\n$$\n\n$$\n"),
    ),
  },
  {
    id: "para.table",
    label: "Insert Table",
    shortcut: "Mod+Alt+T",
    scope: "editor",
    enabled: hasDocument,
    run: edit(
      (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      (v) => insertText(v, TABLE_TEMPLATE),
    ),
  },
  {
    id: "para.horizontalRule",
    label: "Horizontal Rule",
    scope: "editor",
    enabled: hasDocument,
    run: edit(
      (e) => e.chain().focus().setHorizontalRule().run(),
      (v) => insertText(v, "\n---\n"),
    ),
  },
  {
    id: "table.addRowAfter",
    label: "Add Row Below",
    scope: "editor",
    enabled: () => Boolean(wysiwyg()?.can().addRowAfter()),
    run: edit((e) => e.chain().focus().addRowAfter().run()),
  },
  {
    id: "table.addColumnAfter",
    label: "Add Column Right",
    scope: "editor",
    enabled: () => Boolean(wysiwyg()?.can().addColumnAfter()),
    run: edit((e) => e.chain().focus().addColumnAfter().run()),
  },
  {
    id: "table.deleteRow",
    label: "Delete Row",
    scope: "editor",
    enabled: () => Boolean(wysiwyg()?.can().deleteRow()),
    run: edit((e) => e.chain().focus().deleteRow().run()),
  },
  {
    id: "table.deleteColumn",
    label: "Delete Column",
    scope: "editor",
    enabled: () => Boolean(wysiwyg()?.can().deleteColumn()),
    run: edit((e) => e.chain().focus().deleteColumn().run()),
  },
  {
    id: "table.alignLeft",
    label: "Align Column Left",
    scope: "editor",
    enabled: () => Boolean(wysiwyg() && isInTable(wysiwyg()!.state)),
    run: edit((e) => alignColumn(e, "left")),
  },
  {
    id: "table.alignCenter",
    label: "Align Column Center",
    scope: "editor",
    enabled: () => Boolean(wysiwyg() && isInTable(wysiwyg()!.state)),
    run: edit((e) => alignColumn(e, "center")),
  },
  {
    id: "table.alignRight",
    label: "Align Column Right",
    scope: "editor",
    enabled: () => Boolean(wysiwyg() && isInTable(wysiwyg()!.state)),
    run: edit((e) => alignColumn(e, "right")),
  },
  {
    id: "table.delete",
    label: "Delete Table",
    scope: "editor",
    enabled: () => Boolean(wysiwyg()?.can().deleteTable()),
    run: edit((e) => e.chain().focus().deleteTable().run()),
  },

  // Format
  {
    id: "format.bold",
    label: "Bold",
    shortcut: "Mod+B",
    nativeIn: ["wysiwyg"],
    scope: "editor",
    enabled: hasDocument,
    run: edit(
      (e) => e.chain().focus().toggleBold().run(),
      (v) => toggleWrap(v, "**"),
    ),
    checked: () => Boolean(wysiwyg()?.isActive("bold")),
  },
  {
    id: "format.italic",
    label: "Italic",
    shortcut: "Mod+I",
    nativeIn: ["wysiwyg"],
    scope: "editor",
    enabled: hasDocument,
    run: edit(
      (e) => e.chain().focus().toggleItalic().run(),
      (v) => toggleWrap(v, "*"),
    ),
    checked: () => Boolean(wysiwyg()?.isActive("italic")),
  },
  {
    id: "format.strike",
    label: "Strikethrough",
    shortcut: "Mod+Shift+X",
    nativeIn: ["wysiwyg"],
    scope: "editor",
    enabled: hasDocument,
    run: edit(
      (e) => e.chain().focus().toggleStrike().run(),
      (v) => toggleWrap(v, "~~"),
    ),
    checked: () => Boolean(wysiwyg()?.isActive("strike")),
  },
  {
    id: "format.code",
    label: "Inline Code",
    shortcut: "Mod+E",
    nativeIn: ["wysiwyg"],
    scope: "editor",
    enabled: hasDocument,
    run: edit(
      (e) => e.chain().focus().toggleCode().run(),
      (v) => toggleWrap(v, "`"),
    ),
    checked: () => Boolean(wysiwyg()?.isActive("code")),
  },
  {
    id: "format.math",
    label: "Inline Math",
    shortcut: "Mod+M",
    scope: "editor",
    enabled: hasDocument,
    run: edit(
      (e) => e.chain().focus().insertMathInline().run(),
      (v) => toggleWrap(v, "$"),
    ),
  },
  {
    id: "format.link",
    label: "Link…",
    shortcut: "Mod+K",
    scope: "editor",
    enabled: hasDocument,
    run: () => promptLink(),
  },
  {
    id: "format.image",
    label: "Image…",
    shortcut: "Mod+Shift+I",
    scope: "editor",
    enabled: hasDocument,
    run: () => promptImage(),
  },
  {
    id: "format.clear",
    label: "Clear Formatting",
    scope: "editor",
    enabled: inWysiwyg,
    run: edit((e) => e.chain().focus().unsetAllMarks().run()),
  },

  // View
  {
    id: "view.source",
    label: "Source Mode",
    shortcut: "Mod+/",
    scope: "app",
    enabled: hasDocument,
    run: () => {
      const tab = getActiveTab();
      if (tab) switchMode(tab.id);
    },
    checked: () => getActiveTab()?.mode === "source",
  },
  {
    id: "view.sidebar",
    label: "Sidebar",
    shortcut: "Mod+\\",
    scope: "app",
    run: () => toggleSetting("sidebarVisible"),
    checked: () => useSettings.getState().sidebarVisible,
  },
  {
    id: "view.outline",
    label: "Outline",
    scope: "app",
    run: () => useSettings.getState().update({ sidebarVisible: true, sidebarPanel: "outline" }),
    checked: () => useSettings.getState().sidebarPanel === "outline",
  },
  {
    id: "view.files",
    label: "Files",
    scope: "app",
    run: () => useSettings.getState().update({ sidebarVisible: true, sidebarPanel: "files" }),
    checked: () => useSettings.getState().sidebarPanel === "files",
  },
  {
    id: "view.focusMode",
    label: "Focus Mode",
    shortcut: "F8",
    scope: "app",
    run: () => toggleSetting("focusMode"),
    checked: () => useSettings.getState().focusMode,
  },
  {
    id: "view.typewriter",
    label: "Typewriter Mode",
    shortcut: "F9",
    scope: "app",
    run: () => toggleSetting("typewriterMode"),
    checked: () => useSettings.getState().typewriterMode,
  },
  {
    id: "view.themeSystem",
    label: "System Theme",
    scope: "app",
    run: () => useSettings.getState().update({ theme: "system" }),
    checked: () => useSettings.getState().theme === "system",
  },
  {
    id: "view.themeLight",
    label: "Light Theme",
    scope: "app",
    run: () => useSettings.getState().update({ theme: "light" }),
    checked: () => useSettings.getState().theme === "light",
  },
  {
    id: "view.themeDark",
    label: "Dark Theme",
    scope: "app",
    run: () => useSettings.getState().update({ theme: "dark" }),
    checked: () => useSettings.getState().theme === "dark",
  },
  {
    id: "view.zoomIn",
    label: "Increase Font Size",
    shortcut: "Mod+=",
    scope: "app",
    run: () => useSettings.getState().zoom(1),
  },
  {
    id: "view.zoomOut",
    label: "Decrease Font Size",
    shortcut: "Mod+-",
    scope: "app",
    run: () => useSettings.getState().zoom(-1),
  },
  {
    id: "view.zoomReset",
    label: "Reset Font Size",
    scope: "app",
    run: () => useSettings.getState().zoom(0),
  },
  {
    id: "view.autosave",
    label: "Autosave",
    scope: "app",
    run: () => toggleSetting("autosave"),
    checked: () => useSettings.getState().autosave,
  },
  {
    id: "view.settings",
    label: "Settings…",
    shortcut: "Mod+,",
    scope: "app",
    run: () => useUi.getState().setPanel("settings"),
  },
  { id: "tab.next", label: "Next Tab", shortcut: "Ctrl+Tab", scope: "app", run: () => cycleTab(1) },
  {
    id: "tab.previous",
    label: "Previous Tab",
    shortcut: "Ctrl+Shift+Tab",
    scope: "app",
    run: () => cycleTab(-1),
  },

  // Help
  {
    id: "help.shortcuts",
    label: "Keyboard Shortcuts",
    shortcut: "F1",
    scope: "app",
    run: () => useUi.getState().setPanel("shortcuts"),
  },
  {
    id: "help.about",
    label: "About Satr",
    scope: "app",
    run: () => useUi.getState().setPanel("about"),
  },
];

const byId = new Map(COMMANDS.map((c) => [c.id, c]));

export function getCommand(id: string): Command {
  const command = byId.get(id);
  if (!command) throw new Error(`Unknown command ${id}`);
  return command;
}

export function runCommand(id: string): void {
  const command = getCommand(id);
  if (command.enabled && !command.enabled()) return;
  void Promise.resolve(command.run()).catch((error: unknown) => {
    console.error(`Command ${id} failed`, error);
    useUi.getState().toast(
      t("toast.commandFailed", {
        message: error instanceof Error ? error.message : String(error),
      }),
      "error",
    );
  });
}
