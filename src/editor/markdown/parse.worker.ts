/// <reference lib="webworker" />
import { parseMarkdown } from "./parse";

interface Request {
  id: number;
  text: string;
}

self.onmessage = (event: MessageEvent<Request>) => {
  const { id, text } = event.data;
  try {
    self.postMessage({ id, result: parseMarkdown(text) });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
