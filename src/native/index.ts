import type { NativeBridge } from "./bridge";

export * from "./bridge";

let current: NativeBridge | null = null;

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Picks the Tauri bridge inside the desktop app, a demo bridge in a browser. */
export async function initBridge(): Promise<NativeBridge> {
  if (current) return current;
  if (isTauri()) {
    current = (await import("./tauriBridge")).tauriBridge;
  } else {
    current = (await import("./memoryBridge")).createDemoBridge();
  }
  return current;
}

export function setBridge(bridge: NativeBridge): void {
  current = bridge;
}

export function bridge(): NativeBridge {
  if (!current) throw new Error("Native bridge used before initBridge()");
  return current;
}
