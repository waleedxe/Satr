// End-to-end smoke test for the built desktop app (Windows).
//
// Launches the release executable with WebView2 remote debugging enabled,
// drives the real UI through the Chrome DevTools Protocol and checks the
// file on disk. Usage: node scripts/smoke.mjs [path-to-exe]

import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { chromium } from "playwright-core";

const exe = resolve(process.argv[2] ?? "src-tauri/target/release/satr.exe");
const port = 9333;
const shots = resolve("smoke-output");
mkdirSync(shots, { recursive: true });

const dir = mkdtempSync(join(tmpdir(), "md-smoke-"));
const file = join(dir, "smoke.md");
const original = [
  "# Smoke Test",
  "",
  "مرحبا **بالعالم** with English.",
  "",
  "| Name | Qty |",
  "| :--- | --: |",
  "| A    |   1 |",
  "",
  "```ts",
  "const x: number = 1;",
  "```",
  "",
  "$$",
  "E = mc^2",
  "$$",
  "",
  "- [ ] task",
  "",
].join("\r\n");
writeFileSync(file, original);

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function launch() {
  const child = spawn(exe, [file], {
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
    },
    stdio: "ignore",
  });
  let browser;
  for (let i = 0; i < 60 && !browser; i++) {
    await sleep(500);
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`).catch(() => undefined);
  }
  if (!browser) throw new Error("Could not connect to the app's WebView");
  let page;
  for (let i = 0; i < 40 && !page; i++) {
    page = browser.contexts().flatMap((c) => c.pages())[0];
    if (!page) await sleep(250);
  }
  return { child, browser, page };
}

async function stop({ child, browser }) {
  await browser.close().catch(() => undefined);
  child.kill();
  await sleep(1500);
}

let app = await launch();
try {
  const { page } = app;
  await page.waitForSelector(".ProseMirror", { timeout: 20000 });
  check("app launches and opens the file from the command line", true);

  await page.waitForSelector(".math-block .katex", { timeout: 15000 }).catch(() => undefined);
  await page
    .waitForSelector("pre.code-block span[style]", { timeout: 15000 })
    .catch(() => undefined);
  check("table renders", (await page.locator(".ProseMirror table").count()) === 1);
  check(
    "code block is highlighted",
    (await page.locator("pre.code-block span[style]").count()) > 0,
  );
  check("math renders with KaTeX", (await page.locator(".math-block .katex").count()) === 1);
  check("task list renders", (await page.locator('ul[data-type="taskList"]').count()) === 1);
  const dir = await page.locator(".ProseMirror p").first().getAttribute("dir");
  check("paragraphs use automatic text direction", dir === "auto");
  await page.screenshot({ path: join(shots, "1-visual-light.png") });

  // Type formatted Markdown at the end of the document.
  await page.click(".ProseMirror h1");
  await page.keyboard.press("Control+End");
  // The document ends in a task list: Enter twice leaves the list.
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Typed **bold** and *italic* text");
  check(
    "typing shortcuts create bold",
    (await page.locator(".ProseMirror strong", { hasText: "bold" }).count()) === 1,
  );
  check("tab shows unsaved state", (await page.locator(".tab.is-dirty").count()) === 1);

  await page.keyboard.press("Control+s");
  await sleep(800);
  const saved = readFileSync(file, "utf8");
  check("save writes the new paragraph", saved.includes("Typed **bold** and *italic* text"));
  check("save keeps CRLF line endings", !/[^\r]\n/.test(saved));
  check(
    "save keeps untouched blocks byte-for-byte",
    saved === `${original}\r\nTyped **bold** and *italic* text\r\n`,
    JSON.stringify(saved.slice(-80)),
  );
  check("tab is clean after save", (await page.locator(".tab.is-dirty").count()) === 0);

  // Source mode.
  await page.keyboard.press("Control+/");
  await page.waitForSelector(".cm-editor", { timeout: 10000 });
  const sourceText = await page.locator(".cm-content").innerText();
  check("source mode shows raw Markdown", sourceText.includes("| Name | Qty |"));
  await page.screenshot({ path: join(shots, "2-source-mode.png") });
  await page.keyboard.press("Control+/");
  await page.waitForSelector(".ProseMirror", { timeout: 10000 });
  check("switching back to visual mode works", true);

  // Theme switch through the View menu.
  await page.click(".menubar-button:has-text('View')");
  await page.hover(".menu-item:has-text('Theme')");
  await page.click(".menu-item:has-text('Dark Theme')");
  await sleep(300);
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  check("dark theme applies", theme === "dark");
  await page.screenshot({ path: join(shots, "3-visual-dark.png") });

  // Find.
  await page.keyboard.press("Control+f");
  await page.fill(".findbar-input", "bold");
  await sleep(300);
  check("find highlights matches", (await page.locator(".search-match").count()) >= 1);
  await page.keyboard.press("Escape");

  // Outline.
  check("outline lists headings", (await page.locator(".outline-item").count()) >= 1);
} catch (error) {
  check("smoke run", false, error instanceof Error ? error.message : String(error));
} finally {
  await stop(app);
}

// Reopen and verify the formatting survived.
app = await launch();
try {
  const { page } = app;
  await page.waitForSelector(".ProseMirror", { timeout: 20000 });
  check(
    "reopened file shows saved bold text",
    (await page.locator(".ProseMirror strong", { hasText: "bold" }).count()) === 1,
  );
  check(
    "theme setting persisted",
    (await page.evaluate(() => document.documentElement.dataset.theme)) === "dark",
  );
  // Restore the default theme for the next run.
  await page.click(".menubar-button:has-text('View')");
  await page.hover(".menu-item:has-text('Theme')");
  await page.click(".menu-item:has-text('System Theme')");
  await sleep(500);
} catch (error) {
  check("reopen", false, error instanceof Error ? error.message : String(error));
} finally {
  await stop(app);
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed. Screenshots: ${shots}`);
process.exit(failed ? 1 : 0);
