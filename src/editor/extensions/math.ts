import { InputRule, Node, mergeAttributes } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { NodeView } from "@tiptap/pm/view";

import { renderMath } from "../lazy/katex";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    math: {
      insertMathBlock: (latex?: string) => ReturnType;
      insertMathInline: (latex?: string) => ReturnType;
    };
  }
}

/**
 * Shared node view for inline and block math. Shows rendered KaTeX; when the
 * node is selected (or clicked) an input for the LaTeX source appears.
 */
class MathView implements NodeView {
  dom: HTMLElement;
  private preview: HTMLElement;
  private input: HTMLTextAreaElement | HTMLInputElement;
  private node: PMNode;
  private editing = false;
  private renderTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    node: PMNode,
    private editor: Editor,
    private getPos: () => number | undefined,
    private display: boolean,
  ) {
    this.node = node;
    const tag = display ? "div" : "span";
    this.dom = document.createElement(tag);
    this.dom.className = display ? "math-node math-block" : "math-node math-inline";
    this.dom.contentEditable = "false";
    this.preview = document.createElement(tag);
    this.preview.className = "math-preview";
    this.input = display ? document.createElement("textarea") : document.createElement("input");
    this.input.className = "math-source";
    this.input.spellcheck = false;
    this.input.setAttribute("aria-label", display ? "Equation source" : "Inline equation source");
    if (this.input instanceof HTMLTextAreaElement) this.input.rows = 3;
    this.dom.append(this.preview, this.input);

    this.preview.addEventListener("mousedown", (event) => {
      event.preventDefault();
      this.select();
    });
    this.input.addEventListener("input", () => this.commitSource());
    this.input.addEventListener("keydown", (event) => this.onKeyDown(event as KeyboardEvent));
    this.input.addEventListener("blur", () => this.stopEditing());

    renderMath(this.preview, this.latex, this.display);
  }

  private get latex(): string {
    return String(this.node.attrs.latex ?? "");
  }

  private select(): void {
    const pos = this.getPos();
    if (pos === undefined) return;
    const { view } = this.editor;
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)));
    this.startEditing();
  }

  private startEditing(): void {
    if (!this.editor.isEditable) return;
    this.editing = true;
    this.dom.classList.add("is-editing");
    this.input.value = this.latex;
    requestAnimationFrame(() => this.input.focus());
  }

  private stopEditing(): void {
    if (!this.editing) return;
    this.editing = false;
    this.dom.classList.remove("is-editing");
  }

  private commitSource(): void {
    const pos = this.getPos();
    if (pos === undefined) return;
    const latex = this.input.value;
    const { view } = this.editor;
    view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, latex }));
    clearTimeout(this.renderTimer);
    this.renderTimer = setTimeout(() => renderMath(this.preview, latex, this.display), 120);
  }

  /** Leaves the math source and puts the text cursor after the node. */
  private exit(after: boolean): void {
    const pos = this.getPos();
    this.stopEditing();
    if (pos === undefined) return;
    const { view } = this.editor;
    const target = after ? pos + this.node.nodeSize : pos;
    const $pos = view.state.doc.resolve(target);
    const selection =
      TextSelection.findFrom($pos, after ? 1 : -1, true) ?? TextSelection.near($pos);
    view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
    view.focus();
  }

  private onKeyDown(event: KeyboardEvent): void {
    const atEnd = this.input.selectionStart === this.input.value.length;
    const atStart = this.input.selectionEnd === 0;
    if (event.key === "Escape" || (event.key === "Enter" && (event.ctrlKey || !this.display))) {
      event.preventDefault();
      this.exit(true);
    } else if ((event.key === "ArrowDown" || event.key === "ArrowRight") && atEnd) {
      event.preventDefault();
      this.exit(true);
    } else if ((event.key === "ArrowUp" || event.key === "ArrowLeft") && atStart) {
      event.preventDefault();
      this.exit(false);
    }
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    const changed = node.attrs.latex !== this.node.attrs.latex;
    this.node = node;
    if (changed && !this.editing) renderMath(this.preview, this.latex, this.display);
    return true;
  }

  selectNode(): void {
    this.dom.classList.add("ProseMirror-selectednode");
    if (!this.editing) this.startEditing();
  }

  deselectNode(): void {
    this.dom.classList.remove("ProseMirror-selectednode");
    if (document.activeElement !== this.input) this.stopEditing();
  }

  stopEvent(event: Event): boolean {
    return event.target === this.input;
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
    clearTimeout(this.renderTimer);
  }
}

export const MathInline = Node.create({
  name: "mathInline",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return { latex: { default: "" } };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-math-inline]",
        getAttrs: (el) => ({ latex: (el as HTMLElement).getAttribute("data-latex") ?? "" }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-math-inline": "",
        "data-latex": node.attrs.latex,
      }),
      `$${String(node.attrs.latex)}$`,
    ];
  },

  renderText({ node }) {
    return `$${String(node.attrs.latex)}$`;
  },

  addNodeView() {
    return ({ node, editor, getPos }) => new MathView(node, editor, getPos, false);
  },

  addCommands() {
    return {
      insertMathInline:
        (latex = "") =>
        ({ tr, dispatch }) => {
          const node = this.type.create({ latex });
          if (dispatch) {
            const pos = tr.selection.from;
            tr.replaceSelectionWith(node);
            tr.setSelection(NodeSelection.create(tr.doc, pos));
          }
          return true;
        },
    };
  },

  addInputRules() {
    return [
      // `$x$` with no space just inside the dollars (so "$5 and $10" stays text).
      new InputRule({
        find: /(^|[^$\\])\$([^\s$](?:[^$\n]*[^\s$])?)\$$/,
        handler: ({ state, range, match }) => {
          const prefix = match[1] ?? "";
          const latex = match[2] ?? "";
          const from = range.from + prefix.length;
          state.tr.replaceWith(from, range.to, this.type.create({ latex }));
        },
      }),
    ];
  },
});

export const MathBlock = Node.create({
  name: "mathBlock",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return { latex: { default: "" } };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-math-block]",
        getAttrs: (el) => ({ latex: (el as HTMLElement).getAttribute("data-latex") ?? "" }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-math-block": "", "data-latex": node.attrs.latex }),
      `$$\n${String(node.attrs.latex)}\n$$`,
    ];
  },

  renderText({ node }) {
    return `$$\n${String(node.attrs.latex)}\n$$`;
  },

  addNodeView() {
    return ({ node, editor, getPos }) => new MathView(node, editor, getPos, true);
  },

  addCommands() {
    return {
      insertMathBlock:
        (latex = "") =>
        ({ tr, dispatch }) => {
          const node = this.type.create({ latex });
          if (dispatch) {
            const { $from } = tr.selection;
            const empty = $from.parent.isTextblock && $from.parent.content.size === 0;
            if ($from.depth === 0) {
              tr.insert($from.pos, node);
              tr.setSelection(NodeSelection.create(tr.doc, $from.pos));
            } else if (empty) {
              tr.replaceWith($from.before(), $from.after(), node);
              tr.setSelection(NodeSelection.create(tr.doc, $from.before()));
            } else {
              const pos = $from.after();
              tr.insert(pos, node);
              tr.setSelection(NodeSelection.create(tr.doc, pos));
            }
          }
          return true;
        },
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: /^\$\$\s$/,
        handler: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          if ($from.parent.type.name !== "paragraph") return null;
          const start = $from.before();
          state.tr.replaceWith(start, $from.after(), this.type.create({ latex: "" }));
          state.tr.setSelection(NodeSelection.create(state.tr.doc, start));
        },
      }),
    ];
  },
});
