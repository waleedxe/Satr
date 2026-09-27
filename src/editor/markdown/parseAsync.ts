import { parseMarkdown } from "./parse";
import type { ParseResult } from "./parse";

/** Documents smaller than this are parsed on the main thread (faster than messaging). */
const WORKER_THRESHOLD = 64 * 1024;

type Pending = { resolve: (r: ParseResult) => void; reject: (e: Error) => void };

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === "undefined") return null;
  try {
    worker = new Worker(new URL("./parse.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return null;
  }
  worker.onmessage = (
    event: MessageEvent<{ id: number; result?: ParseResult; error?: string }>,
  ) => {
    const entry = pending.get(event.data.id);
    if (!entry) return;
    pending.delete(event.data.id);
    if (event.data.result) entry.resolve(event.data.result);
    else entry.reject(new Error(event.data.error ?? "Markdown parsing failed"));
  };
  worker.onerror = () => {
    for (const entry of pending.values()) entry.reject(new Error("Markdown parser crashed"));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

/** Parses Markdown off the main thread when the document is large. */
export function parseMarkdownAsync(text: string): Promise<ParseResult> {
  const w = text.length >= WORKER_THRESHOLD ? getWorker() : null;
  if (!w) {
    try {
      return Promise.resolve(parseMarkdown(text));
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }
  const id = ++nextId;
  return new Promise<ParseResult>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, text });
  });
}
