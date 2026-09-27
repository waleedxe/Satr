// Font choices: system stacks, fonts bundled with the app (loaded only when
// selected, so unused fonts cost nothing at startup) and any font installed
// on the computer ("system:<Family Name>").

export interface BundledFont {
  id: string;
  label: string;
  family: string;
  fallback: string;
  load: () => Promise<unknown>;
}

export const SYSTEM_STACKS = {
  sans: "var(--font-sans)",
  serif: "var(--font-serif)",
  mono: "var(--font-mono)",
} as const;

export type SystemStackId = keyof typeof SYSTEM_STACKS;

export const BUNDLED_FONTS: BundledFont[] = [
  {
    id: "ibm-plex-arabic",
    label: "IBM Plex Sans Arabic",
    family: "IBM Plex Sans Arabic",
    fallback: "var(--font-sans)",
    load: () =>
      Promise.all([
        import("@fontsource/ibm-plex-sans-arabic/400.css"),
        import("@fontsource/ibm-plex-sans-arabic/700.css"),
      ]),
  },
  {
    id: "cairo",
    label: "Cairo",
    family: "Cairo",
    fallback: "var(--font-sans)",
    load: () =>
      Promise.all([import("@fontsource/cairo/400.css"), import("@fontsource/cairo/700.css")]),
  },
  {
    id: "tajawal",
    label: "Tajawal",
    family: "Tajawal",
    fallback: "var(--font-sans)",
    load: () =>
      Promise.all([import("@fontsource/tajawal/400.css"), import("@fontsource/tajawal/700.css")]),
  },
  {
    id: "noto-naskh",
    label: "Noto Naskh Arabic",
    family: "Noto Naskh Arabic",
    fallback: "var(--font-serif)",
    load: () =>
      Promise.all([
        import("@fontsource/noto-naskh-arabic/400.css"),
        import("@fontsource/noto-naskh-arabic/700.css"),
      ]),
  },
  {
    id: "amiri",
    label: "Amiri",
    family: "Amiri",
    fallback: "var(--font-serif)",
    load: () =>
      Promise.all([import("@fontsource/amiri/400.css"), import("@fontsource/amiri/700.css")]),
  },
];

const SYSTEM_PREFIX = "system:";
// Family names are inserted into CSS, so only allow harmless characters.
const SAFE_FAMILY = /^[\p{L}\p{N} ._\-()&+']{1,100}$/u;

export function systemFontId(family: string): string {
  return `${SYSTEM_PREFIX}${family}`;
}

export function isValidFontId(id: unknown): id is string {
  if (typeof id !== "string") return false;
  if (id in SYSTEM_STACKS) return true;
  if (BUNDLED_FONTS.some((f) => f.id === id)) return true;
  return id.startsWith(SYSTEM_PREFIX) && SAFE_FAMILY.test(id.slice(SYSTEM_PREFIX.length));
}

function quote(family: string): string {
  return `"${family.replace(/["\\]/g, "")}"`;
}

/** CSS font-family value for a font id (falls back to the system sans stack). */
export function fontStack(id: string): string {
  if (id in SYSTEM_STACKS) return SYSTEM_STACKS[id as SystemStackId];
  const bundled = BUNDLED_FONTS.find((f) => f.id === id);
  if (bundled) return `${quote(bundled.family)}, ${bundled.fallback}`;
  if (isValidFontId(id) && id.startsWith(SYSTEM_PREFIX)) {
    return `${quote(id.slice(SYSTEM_PREFIX.length))}, var(--font-sans)`;
  }
  return SYSTEM_STACKS.sans;
}

/** Loads the font files for a bundled font (no-op for system fonts). */
export function ensureFontLoaded(id: string): Promise<void> {
  const bundled = BUNDLED_FONTS.find((f) => f.id === id);
  return bundled ? bundled.load().then(() => undefined) : Promise.resolve();
}
