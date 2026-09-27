export type MenuItem =
  | { type: "command"; command: string }
  | { type: "separator" }
  | { type: "submenu"; label: string; items: MenuItem[] }
  | { type: "recent" };

export interface Menu {
  label: string;
  items: MenuItem[];
}

const c = (command: string): MenuItem => ({ type: "command", command });
const sep: MenuItem = { type: "separator" };

export const MENUS: Menu[] = [
  {
    label: "File",
    items: [
      c("file.new"),
      c("file.open"),
      c("file.openFolder"),
      { type: "recent" },
      sep,
      c("file.save"),
      c("file.saveAs"),
      sep,
      c("file.close"),
      c("app.quit"),
    ],
  },
  {
    label: "Edit",
    items: [
      c("edit.undo"),
      c("edit.redo"),
      sep,
      c("edit.selectAll"),
      sep,
      c("edit.find"),
      c("edit.replace"),
    ],
  },
  {
    label: "Paragraph",
    items: [
      c("para.h1"),
      c("para.h2"),
      c("para.h3"),
      c("para.h4"),
      c("para.h5"),
      c("para.h6"),
      c("para.paragraph"),
      sep,
      c("para.quote"),
      c("para.bulletList"),
      c("para.orderedList"),
      c("para.taskList"),
      sep,
      c("para.codeBlock"),
      c("para.mathBlock"),
      c("para.horizontalRule"),
      sep,
      c("para.table"),
      {
        type: "submenu",
        label: "Table",
        items: [
          c("table.addRowAfter"),
          c("table.addColumnAfter"),
          c("table.deleteRow"),
          c("table.deleteColumn"),
          sep,
          c("table.alignLeft"),
          c("table.alignCenter"),
          c("table.alignRight"),
          sep,
          c("table.delete"),
        ],
      },
    ],
  },
  {
    label: "Format",
    items: [
      c("format.bold"),
      c("format.italic"),
      c("format.strike"),
      c("format.code"),
      c("format.math"),
      sep,
      c("format.link"),
      c("format.image"),
      sep,
      c("format.clear"),
    ],
  },
  {
    label: "View",
    items: [
      c("view.source"),
      sep,
      c("view.sidebar"),
      c("view.outline"),
      c("view.files"),
      sep,
      c("view.focusMode"),
      c("view.typewriter"),
      {
        type: "submenu",
        label: "Theme",
        items: [c("view.themeSystem"), c("view.themeLight"), c("view.themeDark")],
      },
      sep,
      c("view.zoomIn"),
      c("view.zoomOut"),
      c("view.zoomReset"),
      sep,
      c("view.autosave"),
      c("view.settings"),
    ],
  },
  {
    label: "Help",
    items: [c("help.shortcuts"), c("help.about")],
  },
];
