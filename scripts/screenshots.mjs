// Captures showcase screenshots of the real app (Windows).
// Build first with `npm run smoke:build`, then: node scripts/screenshots.mjs

import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { chromium } from "playwright-core";

const exe = resolve(process.argv[2] ?? "src-tauri/target/debug/satr.exe");
const out = resolve("screenshots");
mkdirSync(out, { recursive: true });

const dir = mkdtempSync(join(tmpdir(), "satr-shots-"));
const file = join(dir, "خطة الإطلاق.md");
writeFileSync(
  file,
  `# خطة إطلاق سطر

سطر محرر ماركداون **خفيف** و*هادئ*، يحفظ ملفاتك كما هي على جهازك. يدعم الكتابة بالعربي و English في نفس السطر.

## المهام

- [x] محرك الماركداون مع اختبارات الحفظ
- [x] فتح الملفات وحفظها
- [ ] التوقيع الرقمي لملف التثبيت

## الأداء

| القياس | النتيجة |
| :----- | ------: |
| حجم التثبيت | 3.1 MB |
| وقت الفتح | 0.2 s |
| الذاكرة | 170 MB |

## Code

\`\`\`ts
export async function save(doc: Doc): Promise<void> {
  const markdown = serialize(doc); // untouched blocks stay byte-for-byte
  await bridge.writeDocument(doc.path, markdown);
}
\`\`\`

## المعادلة

وقت القراءة $t = \\frac{w}{200}$ دقيقة، والمتوسط:

$$
\\bar{x} = \\frac{1}{n} \\sum_{i=1}^{n} x_i
$$

> ملفاتك تبقى على جهازك: بدون حساب، بدون سحابة، بدون تتبع.
`,
);

async function launch(args) {
  const child = spawn(exe, args, { stdio: "ignore" });
  let browser;
  for (let i = 0; i < 60 && !browser; i++) {
    await sleep(500);
    browser = await chromium.connectOverCDP("http://127.0.0.1:9333").catch(() => undefined);
  }
  if (!browser) throw new Error("Could not connect to the app");
  let page;
  for (let i = 0; i < 40 && !page; i++) {
    page = browser.contexts().flatMap((c) => c.pages())[0];
    if (!page) await sleep(250);
  }
  return { child, browser, page };
}

async function setTheme(page, name) {
  await page.click(".menubar-button:has-text('View')");
  await page.hover(".menu-item:has-text('Theme')");
  await page.click(`.menu-item:has-text('${name}')`);
  await sleep(400);
}

// Welcome screen.
let app = await launch([]);
await app.page.waitForSelector(".empty-state", { timeout: 20000 });
await setTheme(app.page, "Light Theme");
await app.page.screenshot({ path: join(out, "welcome.png") });
await app.browser.close();
app.child.kill();
await sleep(1500);

// Document.
app = await launch([file]);
const { page } = app;
await page.waitForSelector(".ProseMirror", { timeout: 20000 });
await page.waitForSelector(".math-block .katex", { timeout: 15000 }).catch(() => undefined);
await page.waitForSelector("pre.code-block span[style]", { timeout: 15000 }).catch(() => undefined);
await sleep(500);
await page.click(".ProseMirror h2 >> nth=0");
await page.screenshot({ path: join(out, "light.png") });
await page.evaluate(() => document.querySelector(".editor-scroll")?.scrollTo(0, 99999));
await sleep(300);
await page.screenshot({ path: join(out, "light-bottom.png") });
await page.evaluate(() => document.querySelector(".editor-scroll")?.scrollTo(0, 0));

await setTheme(page, "Dark Theme");
await page.screenshot({ path: join(out, "dark.png") });

await page.keyboard.press("Control+f");
await page.fill(".findbar-input", "سطر");
await sleep(400);
await page.screenshot({ path: join(out, "find.png") });
await page.keyboard.press("Escape");

await page.keyboard.press("Control+/");
await page.waitForSelector(".cm-editor");
await sleep(400);
await page.screenshot({ path: join(out, "source.png") });
await page.keyboard.press("Control+/");
await page.waitForSelector(".ProseMirror");

await page.keyboard.press("Control+,");
await sleep(400);
await page.screenshot({ path: join(out, "settings.png") });
await page.keyboard.press("Escape");

// Arabic interface with a bundled Arabic font.
await setTheme(page, "Light Theme");
await page.keyboard.press("Control+,");
await page.selectOption("#setting-language", "ar");
await page.selectOption("#setting-font", "ibm-plex-arabic");
await page.selectOption("#setting-heading-font", "cairo");
await sleep(800);
await page.screenshot({ path: join(out, "settings-ar.png") });
await page.keyboard.press("Escape");
await sleep(300);
await page.screenshot({ path: join(out, "arabic-ui.png") });
await page.click(".menubar-button >> nth=0");
await sleep(300);
await page.screenshot({ path: join(out, "menu-ar.png") });
await page.keyboard.press("Escape");

// Restore defaults for the next run.
await page.keyboard.press("Control+,");
await page.selectOption("#setting-language", "en");
await page.selectOption("#setting-font", "sans");
await page.selectOption("#setting-heading-font", "same");
await page.keyboard.press("Escape");
await setTheme(page, "System Theme");
await app.browser.close();
app.child.kill();
console.log(`Screenshots saved to ${out}`);
