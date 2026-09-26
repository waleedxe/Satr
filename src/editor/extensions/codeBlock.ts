import CodeBlock from "@tiptap/extension-code-block";
import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * Fenced code block with an editable language label. `meta` keeps anything
 * written after the language on the fence line (```js title="x").
 */
export const MarkdownCodeBlock = CodeBlock.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      meta: { default: null, rendered: false },
    };
  },

  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Tab: () => {
        if (!this.editor.isActive(this.name)) return false;
        return this.editor.commands.insertContent("  ");
      },
    };
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      let current: PMNode = node;
      const dom = document.createElement("pre");
      dom.className = "code-block";
      const toolbar = document.createElement("div");
      toolbar.className = "code-block-toolbar";
      toolbar.contentEditable = "false";
      const lang = document.createElement("input");
      lang.className = "code-block-lang";
      lang.placeholder = "language";
      lang.spellcheck = false;
      lang.setAttribute("aria-label", "Code block language");
      lang.value = String(node.attrs.language ?? "");
      toolbar.append(lang);
      const code = document.createElement("code");
      code.spellcheck = false;
      dom.append(toolbar, code);

      const commit = () => {
        const pos = getPos();
        if (pos === undefined) return;
        const language = lang.value.trim().toLowerCase() || null;
        if (language === (current.attrs.language ?? null)) return;
        editor.view.dispatch(
          editor.view.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, language }),
        );
      };
      lang.addEventListener("change", commit);
      lang.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === "Escape") {
          event.preventDefault();
          commit();
          editor.commands.focus();
        }
      });

      return {
        dom,
        contentDOM: code,
        update: (next: PMNode) => {
          if (next.type !== current.type) return false;
          current = next;
          if (document.activeElement !== lang) lang.value = String(next.attrs.language ?? "");
          return true;
        },
        stopEvent: (event: Event) => toolbar.contains(event.target as globalThis.Node),
        ignoreMutation: (mutation) =>
          mutation.type !== "selection" && toolbar.contains(mutation.target),
      };
    };
  },
}).configure({ defaultLanguage: null, languageClassPrefix: "language-" });
