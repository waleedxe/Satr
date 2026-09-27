export interface TextStats {
  words: number;
  characters: number;
  readingMinutes: number;
}

// CJK characters count as one word each; other scripts count runs of
// letters/digits (with inner apostrophes), which works for Arabic too.
const WORD_RE =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]|[\p{L}\p{N}\p{M}]+(?:['’][\p{L}\p{N}\p{M}]+)*/gu;

export const WORDS_PER_MINUTE = 200;

export function computeStats(text: string): TextStats {
  let words = 0;
  for (const _match of text.matchAll(WORD_RE)) words++;
  let characters = 0;
  for (const ch of text) if (ch !== "\n" && ch !== "\r") characters++;
  return {
    words,
    characters,
    readingMinutes: words === 0 ? 0 : Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
  };
}
