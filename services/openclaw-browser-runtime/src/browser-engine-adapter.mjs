import { createHash, randomUUID } from "node:crypto";
import { accessSync, constants, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

import puppeteer from "puppeteer-core";
import {
  WORK_VIEW_VISUAL_FRAME_HEIGHT,
  WORK_VIEW_VISUAL_FRAME_FRESHNESS_MS,
  WORK_VIEW_VISUAL_FRAME_MAX_BYTES,
  WORK_VIEW_VISUAL_FRAME_REGISTRY,
  WORK_VIEW_VISUAL_FRAME_WIDTH,
  projectWorkViewVisualFrame,
  unavailableWorkViewVisualFrame,
} from "../../../packages/shared-utils/src/work-view-visual-frame.mjs";
import {
  WORK_VIEW_SEMANTIC_TARGET_MAX_ITEMS,
  WORK_VIEW_SEMANTIC_TARGET_MAX_NAME_CHARS,
  projectWorkViewSemanticTargets,
  unavailableWorkViewSemanticTargets,
} from "../../../packages/shared-utils/src/work-view-semantic-targets.mjs";

const ENGINE_REGISTRY = "openclaw-browser-engine-adapter-v0";
const MAX_RESTORED_TABS = 32;
const FRAME_JPEG_QUALITY = 55;

function requiredAbsolutePath(value, label) {
  const resolved = typeof value === "string" && value.trim() ? path.resolve(value) : null;
  if (!resolved || resolved === path.parse(resolved).root) {
    throw new Error(`Real browser engine requires a bounded ${label}.`);
  }
  return resolved;
}

function uniqueUrls(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()))]
    .slice(-MAX_RESTORED_TABS);
}

export function createBrowserEngineAdapter({
  executablePath,
  profileDirectory,
  browserFamily = "firefox",
  puppeteerApi = puppeteer,
  navigationTimeoutMs = 10_000,
  onDisconnected = () => {},
} = {}) {
  if (!["chrome", "firefox"].includes(browserFamily)) {
    throw new Error(`Unsupported real browser family: ${browserFamily}.`);
  }
  const browserExecutable = requiredAbsolutePath(executablePath, "executable path");
  const boundedProfileDirectory = requiredAbsolutePath(profileDirectory, "profile directory");
  let browser = null;
  let activePage = null;
  let visualFrame = null;
  let semanticTargets = unavailableWorkViewSemanticTargets("not_captured");
  let visualFrameEpoch = 0;
  let visualFrameSequence = 0;
  let visualFramePromise = null;
  const pageIds = new WeakMap();

  function invalidateVisualFrame() {
    visualFrameEpoch += 1;
    visualFrame = null;
    semanticTargets = unavailableWorkViewSemanticTargets("frame_invalidated");
  }

  async function collectSemanticTargets(page) {
    return page.evaluate((limits) => {
      const selector = [
        "a[href]", "button", "input:not([type=hidden])", "select", "textarea",
        "[role=button]", "[role=link]", "[role=textbox]", "[role=checkbox]",
        "[role=radio]", "[role=combobox]", "[contenteditable=true]",
      ].join(",");
      const text = (value) => typeof value === "string"
        ? value.replace(/\s+/gu, " ").trim().slice(0, limits.maxNameChars)
        : "";
      const roleFor = (element) => {
        const explicit = text(element.getAttribute("role"));
        if (explicit) return explicit;
        const tag = element.tagName.toLowerCase();
        if (tag === "a") return "link";
        if (tag === "button") return "button";
        if (tag === "select") return "combobox";
        if (tag === "textarea" || element.isContentEditable) return "textbox";
        const inputType = text(element.getAttribute("type") || "text").toLowerCase();
        if (["button", "submit", "reset"].includes(inputType)) return "button";
        if (["checkbox", "radio"].includes(inputType)) return inputType;
        return "textbox";
      };
      const nameFor = (element) => {
        const labelledBy = text(element.getAttribute("aria-labelledby"));
        const labelledText = labelledBy
          ? labelledBy.split(/\s+/u).map((id) => document.getElementById(id)?.textContent ?? "").join(" ")
          : "";
        const labelText = Array.from(element.labels ?? []).map((label) => label.textContent ?? "").join(" ");
        return text(
          element.getAttribute("aria-label")
          || labelledText
          || labelText
          || element.getAttribute("alt")
          || element.getAttribute("placeholder")
          || element.getAttribute("title")
          || element.innerText
          || element.textContent,
        );
      };
      const items = [];
      for (const element of document.querySelectorAll(selector)) {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const x = Math.max(0, rect.left);
        const y = Math.max(0, rect.top);
        const right = Math.min(limits.viewportWidth, rect.right);
        const bottom = Math.min(limits.viewportHeight, rect.bottom);
        if (style.display === "none"
          || style.visibility === "hidden"
          || Number.parseFloat(style.opacity || "1") <= 0
          || right <= x
          || bottom <= y) {
          continue;
        }
        const tag = element.tagName.toLowerCase();
        items.push({
          role: roleFor(element),
          tag,
          name: nameFor(element),
          inputType: tag === "input" ? text(element.getAttribute("type") || "text").toLowerCase() : null,
          disabled: element.disabled === true || element.getAttribute("aria-disabled") === "true",
          bounds: { x, y, width: right - x, height: bottom - y },
        });
        if (items.length > limits.maxItems) break;
      }
      return { items, truncated: items.length > limits.maxItems };
    }, {
      maxItems: WORK_VIEW_SEMANTIC_TARGET_MAX_ITEMS,
      maxNameChars: WORK_VIEW_SEMANTIC_TARGET_MAX_NAME_CHARS,
      viewportWidth: WORK_VIEW_VISUAL_FRAME_WIDTH,
      viewportHeight: WORK_VIEW_VISUAL_FRAME_HEIGHT,
    });
  }

  async function configurePage(page) {
    await page.setViewport({
      width: WORK_VIEW_VISUAL_FRAME_WIDTH,
      height: WORK_VIEW_VISUAL_FRAME_HEIGHT,
      deviceScaleFactor: 1,
    });
    return page;
  }

  function pageId(page) {
    if (!pageIds.has(page)) pageIds.set(page, `engine-tab-${randomUUID()}`);
    return pageIds.get(page);
  }

  async function pageSummary(page) {
    return {
      id: pageId(page),
      url: page.url(),
      title: (await page.title()).slice(0, 200),
      createdAt: null,
    };
  }

  async function snapshot() {
    const pages = browser ? await browser.pages() : [];
    const tabs = await Promise.all(pages
      .filter((page) => page.url() !== "about:blank" || page === activePage)
      .map(pageSummary));
    const active = activePage && pages.includes(activePage)
      ? await pageSummary(activePage)
      : tabs.at(-1) ?? null;
    return {
      registry: ENGINE_REGISTRY,
      mode: browserFamily,
      realEngine: Boolean(browser?.connected),
      browserPid: browser?.process()?.pid ?? null,
      activeTitle: active?.title ?? null,
      activeUrl: active?.url ?? null,
      tabs,
      tabCount: tabs.length,
      profileEphemeral: true,
      desktopWideCapture: false,
      rootRequired: false,
    };
  }

  async function ensureBrowser() {
    if (browser?.connected) return false;
    accessSync(browserExecutable, constants.X_OK);
    rmSync(boundedProfileDirectory, { recursive: true, force: true });
    mkdirSync(boundedProfileDirectory, { recursive: true, mode: 0o700 });
    browser = await puppeteerApi.launch({
      browser: browserFamily,
      executablePath: browserExecutable,
      headless: true,
      userDataDir: boundedProfileDirectory,
      args: browserFamily === "chrome" ? [
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-default-apps",
        "--disable-sync",
        "--metrics-recording-only",
        "--no-first-run",
        "--safebrowsing-disable-auto-update",
      ] : [],
    });
    browser.once("disconnected", () => {
      browser = null;
      activePage = null;
      invalidateVisualFrame();
      rmSync(boundedProfileDirectory, { recursive: true, force: true });
      onDisconnected();
    });
    return true;
  }

  async function navigatePage(page, url) {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: navigationTimeoutMs });
    return page;
  }

  async function open({ url, restoreUrls = [] } = {}) {
    const started = await ensureBrowser();
    const existingPages = await browser.pages();
    if (started) {
      const initialPage = await configurePage(existingPages[0] ?? await browser.newPage());
      const restored = uniqueUrls(restoreUrls).filter((candidate) => candidate !== url);
      for (const restoredUrl of restored) {
        const page = await configurePage(await browser.newPage());
        try {
          await navigatePage(page, restoredUrl);
        } catch {
          await page.close().catch(() => {});
        }
      }
      activePage = await navigatePage(initialPage, url);
    } else {
      activePage = await navigatePage(await configurePage(await browser.newPage()), url);
    }
    await activePage.bringToFront();
    invalidateVisualFrame();
    return snapshot();
  }

  async function newTab(url) {
    await ensureBrowser();
    activePage = await navigatePage(await configurePage(await browser.newPage()), url);
    await activePage.bringToFront();
    invalidateVisualFrame();
    return snapshot();
  }

  async function type(text) {
    if (!activePage) throw new Error("Real browser engine has no active page.");
    await activePage.keyboard.type(String(text).slice(0, 2_000));
    invalidateVisualFrame();
    return snapshot();
  }

  async function click({ x, y }) {
    if (!activePage) throw new Error("Real browser engine has no active page.");
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error("Real browser click requires finite coordinates.");
    }
    await activePage.mouse.click(x, y);
    invalidateVisualFrame();
    return snapshot();
  }

  async function captureVisualFrame({ includeData = true } = {}) {
    if (!activePage || !browser?.connected) return unavailableWorkViewVisualFrame("browser_not_running");
    const capturedAtMs = Date.parse(visualFrame?.capturedAt ?? "");
    if (visualFrame && Number.isFinite(capturedAtMs) && Date.now() - capturedAtMs <= WORK_VIEW_VISUAL_FRAME_FRESHNESS_MS) {
      return projectWorkViewVisualFrame(visualFrame, { includeData });
    }
    if (!visualFramePromise) {
      const captureEpoch = visualFrameEpoch;
      visualFramePromise = (async () => {
        const page = activePage;
        const bytes = Buffer.from(await page.screenshot({
          type: "jpeg",
          quality: FRAME_JPEG_QUALITY,
          captureBeyondViewport: false,
          encoding: "binary",
        }));
        if (captureEpoch !== visualFrameEpoch) {
          return unavailableWorkViewVisualFrame("frame_invalidated_during_capture", {
            capturedAt: new Date().toISOString(),
            byteLength: bytes.length,
          });
        }
        if (bytes.length > WORK_VIEW_VISUAL_FRAME_MAX_BYTES) {
          visualFrame = unavailableWorkViewVisualFrame("frame_exceeds_byte_limit", {
            capturedAt: new Date().toISOString(),
            byteLength: bytes.length,
          });
          return visualFrame;
        }
        const capturedAt = new Date().toISOString();
        const nextSequence = visualFrameSequence + 1;
        const candidateFrame = {
          registry: WORK_VIEW_VISUAL_FRAME_REGISTRY,
          available: true,
          reason: null,
          sourceScope: "ai_owned_active_page_only",
          pageId: pageId(page),
          pageUrl: page.url().slice(0, 2048),
          mediaType: "image/jpeg",
          encoding: "base64_data_url",
          width: WORK_VIEW_VISUAL_FRAME_WIDTH,
          height: WORK_VIEW_VISUAL_FRAME_HEIGHT,
          byteLength: bytes.length,
          maxBytes: WORK_VIEW_VISUAL_FRAME_MAX_BYTES,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          capturedAt,
          sequence: nextSequence,
          desktopWideCapture: false,
          persisted: false,
          dataUrl: `data:image/jpeg;base64,${bytes.toString("base64")}`,
        };
        let candidateTargets;
        try {
          const collected = await collectSemanticTargets(page);
          candidateTargets = projectWorkViewSemanticTargets({
            available: true,
            pageUrl: page.url(),
            frame: candidateFrame,
            items: collected.items,
            truncated: collected.truncated,
          });
        } catch {
          candidateTargets = unavailableWorkViewSemanticTargets("semantic_target_collection_failed");
        }
        if (captureEpoch !== visualFrameEpoch || page.url() !== candidateFrame.pageUrl) {
          return unavailableWorkViewVisualFrame("frame_invalidated_during_semantic_collection", {
            capturedAt,
            byteLength: bytes.length,
          });
        }
        visualFrameSequence = nextSequence;
        visualFrame = candidateFrame;
        semanticTargets = candidateTargets;
        return visualFrame;
      })().finally(() => {
        visualFramePromise = null;
      });
    }
    return projectWorkViewVisualFrame(await visualFramePromise, { includeData });
  }

  async function close() {
    const current = browser;
    browser = null;
    activePage = null;
    invalidateVisualFrame();
    await current?.close().catch(() => {});
    rmSync(boundedProfileDirectory, { recursive: true, force: true });
  }

  function semanticTargetInventory() {
    return projectWorkViewSemanticTargets(semanticTargets);
  }

  return { captureVisualFrame, click, close, newTab, open, semanticTargetInventory, snapshot, type };
}
