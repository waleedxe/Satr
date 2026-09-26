// KaTeX is heavy (JS + CSS + fonts), so it is only loaded once a document
// actually contains math.

import type KatexModule from "katex";

type Katex = typeof KatexModule;

let katexPromise: Promise<Katex> | null = null;

export function loadKatex(): Promise<Katex> {
  katexPromise ??= Promise.all([import("katex"), import("katex/dist/katex.min.css")]).then(
    ([mod]) => mod.default,
  );
  return katexPromise;
}

export function renderMath(target: HTMLElement, latex: string, displayMode: boolean): void {
  if (!latex.trim()) {
    target.textContent = displayMode ? "Empty equation" : "$ $";
    target.classList.add("math-empty");
    return;
  }
  target.classList.remove("math-empty");
  loadKatex()
    .then((katex) => {
      target.classList.remove("math-error");
      katex.render(latex, target, {
        displayMode,
        throwOnError: false,
        // Documents are untrusted: never allow \href, \includegraphics etc.
        trust: false,
        strict: "ignore",
        maxExpand: 1000,
        maxSize: 50,
      });
    })
    .catch(() => {
      target.textContent = latex;
      target.classList.add("math-error");
    });
}
