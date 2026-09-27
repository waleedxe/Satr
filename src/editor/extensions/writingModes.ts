import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, Selection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface WritingModesOptions {
  /** Read at runtime so toggling a setting needs no editor rebuild. */
  isTypewriter: () => boolean;
}

const focusKey = new PluginKey<DecorationSet>("focusBlock");

/**
 * Focus mode: marks the top-level block holding the cursor so CSS can dim
 * the rest. Typewriter mode: keeps the cursor line vertically centered.
 */
export const WritingModes = Extension.create<WritingModesOptions>({
  name: "writingModes",

  addOptions() {
    return { isTypewriter: () => false };
  },

  // Browsers stop Ctrl+Home/End at non-editable nodes (math, checkboxes),
  // so jump to the document edges explicitly.
  addKeyboardShortcuts() {
    const jump = (atEnd: boolean) => {
      const { state, view } = this.editor;
      const selection = atEnd ? Selection.atEnd(state.doc) : Selection.atStart(state.doc);
      view.dispatch(state.tr.setSelection(selection).scrollIntoView());
      return true;
    };
    return {
      "Mod-End": () => jump(true),
      "Mod-Home": () => jump(false),
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin<DecorationSet>({
        key: focusKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set, _old, state) {
            if (!tr.docChanged && !tr.selectionSet) return set;
            const { $head } = state.selection;
            if ($head.depth < 1) return DecorationSet.empty;
            const start = $head.before(1);
            const node = state.doc.nodeAt(start);
            if (!node) return DecorationSet.empty;
            return DecorationSet.create(state.doc, [
              Decoration.node(start, start + node.nodeSize, { class: "is-focused-block" }),
            ]);
          },
        },
        props: {
          decorations: (state) => focusKey.getState(state),
        },
        view: () => ({
          update(view, prev) {
            if (!options.isTypewriter() || !view.hasFocus()) return;
            if (prev.selection.eq(view.state.selection) && prev.doc.eq(view.state.doc)) return;
            const scroller = view.dom.closest(".editor-scroll");
            if (!scroller) return;
            requestAnimationFrame(() => {
              const coords = view.coordsAtPos(view.state.selection.head);
              const box = scroller.getBoundingClientRect();
              const offset = coords.top - (box.top + box.height / 2);
              if (Math.abs(offset) > 4) scroller.scrollBy({ top: offset });
            });
          },
        }),
      }),
    ];
  },
});
