import Image from "@tiptap/extension-image";
import type { Node as PMNode } from "@tiptap/pm/model";

import { resolveImageSrc } from "./documentContext";

/** Inline Markdown image whose `src` is kept exactly as written in the file. */
export const MarkdownImage = Image.extend({
  draggable: true,

  addNodeView() {
    return ({ node, editor }) => {
      const dom = document.createElement("span");
      dom.className = "image-node";
      const img = document.createElement("img");
      img.draggable = false;
      img.loading = "lazy";
      img.decoding = "async";
      const fallback = document.createElement("span");
      fallback.className = "image-fallback";
      dom.append(img, fallback);

      let current: PMNode = node;
      const render = () => {
        const src = String(current.attrs.src ?? "");
        const alt = String(current.attrs.alt ?? "");
        const resolved = resolveImageSrc(src, editor.storage.documentContext);
        img.alt = alt;
        img.title = String(current.attrs.title ?? "");
        fallback.textContent = `Image not found: ${alt || src}`;
        dom.classList.toggle("is-broken", !resolved);
        if (resolved && img.getAttribute("src") !== resolved) img.src = resolved;
      };
      img.addEventListener("error", () => dom.classList.add("is-broken"));
      img.addEventListener("load", () => dom.classList.remove("is-broken"));
      render();

      return {
        dom,
        update: (next: PMNode) => {
          if (next.type !== current.type) return false;
          current = next;
          render();
          return true;
        },
        selectNode: () => dom.classList.add("ProseMirror-selectednode"),
        deselectNode: () => dom.classList.remove("ProseMirror-selectednode"),
      };
    };
  },
}).configure({ inline: true, allowBase64: true });
