import type { EditorView } from "@codemirror/view";

/** Wraps (or unwraps) the selection with a Markdown marker such as `**`. */
export function toggleWrap(view: EditorView, marker: string, closing = marker): boolean {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const before = state.sliceDoc(range.from - marker.length, range.from);
    const after = state.sliceDoc(range.to, range.to + closing.length);
    if (before === marker && after === closing) {
      return {
        changes: [
          { from: range.from - marker.length, to: range.from, insert: "" },
          { from: range.to, to: range.to + closing.length, insert: "" },
        ],
        range: range.extend(range.from - marker.length, range.to - marker.length),
      };
    }
    return {
      changes: [
        { from: range.from, insert: marker },
        { from: range.to, insert: closing },
      ],
      range: range.extend(range.from + marker.length, range.to + marker.length),
    };
  });
  view.dispatch(state.update(changes, { scrollIntoView: true, userEvent: "input" }));
  view.focus();
  return true;
}

/** Sets the line prefix of every selected line (e.g. `## `, `> `, `- `); empty clears. */
export function setLinePrefix(view: EditorView, prefix: string): boolean {
  const { state } = view;
  const changes: { from: number; to: number; insert: string }[] = [];
  const seen = new Set<number>();
  for (const range of state.selection.ranges) {
    for (let pos = range.from; pos <= range.to;) {
      const line = state.doc.lineAt(pos);
      if (!seen.has(line.number)) {
        seen.add(line.number);
        const existing =
          /^(#{1,6}\s+|>\s?|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)?/.exec(line.text)?.[0] ?? "";
        changes.push({ from: line.from, to: line.from + existing.length, insert: prefix });
      }
      pos = line.to + 1;
    }
  }
  view.dispatch({ changes, userEvent: "input" });
  view.focus();
  return true;
}

export function insertText(view: EditorView, text: string): boolean {
  view.dispatch(view.state.replaceSelection(text));
  view.focus();
  return true;
}
