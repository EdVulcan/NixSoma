import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const defaultExecFileAsync = promisify(execFile);
const defaultReadFileAsync = readFile;

export const SYSTEMD_BOOT_EVIDENCE_REGISTRY = "openclaw-systemd-boot-evidence-v0";

const BOOT_ID_PATH = "/proc/sys/kernel/random/boot_id";
const MAX_BOOT_RECORDS = 64;
const MAX_TERMINAL_ENTRIES = 64;
const MAX_MESSAGE_CHARS = 512;
const DEFAULT_TIMEOUT_MS = 2500;
const MAX_OUTPUT_BYTES = 256 * 1024;
const BOOT_ID_PATTERN = /^[0-9a-f]{32}$/u;
const BOOT_ID_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

const BOOT_LIST_ARGS = [
  "--no-pager",
  "--quiet",
  "--list-boots",
  "--output=json",
];
const TERMINAL_ARGS = [
  "--no-pager",
  "--quiet",
  "--boot=-1",
  "--output=json",
  "--reverse",
  "--lines",
  String(MAX_TERMINAL_ENTRIES),
  "--output-fields=_BOOT_ID,__REALTIME_TIMESTAMP,_SYSTEMD_UNIT,SYSLOG_IDENTIFIER,MESSAGE_ID,MESSAGE,PRIORITY,_TRANSPORT",
];

function parseInteger(value) {
  const number = Number.parseInt(String(value ?? ""), 10);
  return Number.isSafeInteger(number) ? number : null;
}

function timestampFromMicroseconds(value) {
  const microseconds = parseInteger(value);
  if (!Number.isSafeInteger(microseconds) || microseconds <= 0) return null;
  try {
    return new Date(Math.floor(microseconds / 1000)).toISOString();
  } catch {
    return null;
  }
}

function normaliseBootId(value) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (BOOT_ID_PATTERN.test(raw)) return raw;
  if (BOOT_ID_UUID_PATTERN.test(raw)) return raw.replaceAll("-", "");
  return null;
}

function durationSeconds(firstEntry, lastEntry) {
  const first = parseInteger(firstEntry);
  const last = parseInteger(lastEntry);
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || last < first) return null;
  return Number(((last - first) / 1_000_000).toFixed(3));
}

function boundedMessage(value) {
  return typeof value === "string" ? value.slice(0, MAX_MESSAGE_CHARS).toLowerCase() : "";
}

function normaliseBootRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const index = parseInteger(record.index);
  const bootId = normaliseBootId(record.boot_id);
  if (!Number.isSafeInteger(index) || !bootId) return null;
  return {
    index,
    bootId,
    firstEntryAt: timestampFromMicroseconds(record.first_entry),
    lastEntryAt: timestampFromMicroseconds(record.last_entry),
    durationSeconds: durationSeconds(record.first_entry, record.last_entry),
  };
}

function parseBootRecords(stdout) {
  let value;
  try {
    value = JSON.parse(String(stdout ?? ""));
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  return value.map(normaliseBootRecord).filter(Boolean).slice(-MAX_BOOT_RECORDS);
}

function parseTerminalEntries(stdout) {
  return String(stdout ?? "")
    .split(/\r?\n/u)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const record = JSON.parse(line);
        if (!record || typeof record !== "object" || Array.isArray(record)) return [];
        return [{
          bootId: typeof record._BOOT_ID === "string" ? record._BOOT_ID : null,
          unit: typeof record._SYSTEMD_UNIT === "string" ? record._SYSTEMD_UNIT : null,
          identifier: typeof record.SYSLOG_IDENTIFIER === "string" ? record.SYSLOG_IDENTIFIER : null,
          messageId: typeof record.MESSAGE_ID === "string" ? record.MESSAGE_ID : null,
          message: boundedMessage(record.MESSAGE),
          priority: parseInteger(record.PRIORITY),
          transport: typeof record._TRANSPORT === "string" ? record._TRANSPORT : null,
        }];
      } catch {
        return [];
      }
    });
}

function classifyTerminalEntries(entries) {
  const markers = new Set();
  for (const entry of entries) {
    const unit = entry.unit ?? "";
    const identifier = entry.identifier ?? "";
    const text = `${unit} ${identifier} ${entry.message}`.toLowerCase();
    if (unit === "systemd-reboot.service" || text.includes("system reboot") || text.includes("reached target system reboot")) {
      markers.add("systemd_reboot_sequence");
    }
    if (unit === "systemd-poweroff.service" || text.includes("system poweroff") || text.includes("reached target system poweroff")) {
      markers.add("systemd_poweroff_sequence");
    }
    if (unit === "systemd-shutdown.service" || identifier === "systemd-shutdown") {
      markers.add("systemd_shutdown_sequence");
    }
    if (text.includes("ctrl-alt-del") || text.includes("ctrl+alt+delete") || text.includes("ctrl-alt-delete")) {
      markers.add("ctrl_alt_delete_marker");
    }
    if (/\bwatchdog\b.*(?:timed out|timeout\s+(?:expired|detected)|expired|triggered|reset|bite|lockup|hung|failed)/u.test(text)) {
      markers.add("watchdog_marker");
    }
    if (text.includes("kernel panic") || text.includes("oops:") || text.includes("bug: unable to handle")) {
      markers.add("kernel_fault_marker");
    }
    if (/\b(?:out of memory|oom-kill|killed process)\b/u.test(text)) {
      markers.add("oom_marker");
    }
  }

  let classification = "unknown";
  if (markers.has("kernel_fault_marker")) classification = "kernel_fault";
  else if (markers.has("watchdog_marker")) classification = "watchdog";
  else if (markers.has("oom_marker")) classification = "oom";
  else if (markers.has("ctrl_alt_delete_marker")) classification = "ctrl_alt_delete";
  else if (markers.has("systemd_reboot_sequence")) classification = "explicit_reboot_sequence";
  else if (markers.has("systemd_poweroff_sequence")) classification = "explicit_poweroff_sequence";
  else if (markers.has("systemd_shutdown_sequence")) classification = "shutdown_sequence_without_cause";

  return {
    classification,
    markers: [...markers].sort(),
    inspectedEntries: entries.length,
  };
}

function governance() {
  return {
    domain: "body_internal",
    risk: "low",
    autonomy: "observe_only",
    approvalRequired: false,
    hostMutation: false,
    canMutate: false,
    executesCommand: true,
    readOnlyCommand: true,
    commandArgsBound: true,
    createsTask: false,
    triggersRecovery: false,
    schedulesFollowUp: false,
    messagesIncluded: false,
    persistentEvidence: false,
  };
}

function unavailableResponse(errorCode = "JOURNALCTL_FAILED") {
  return {
    ok: true,
    registry: SYSTEMD_BOOT_EVIDENCE_REGISTRY,
    mode: "read_only",
    available: false,
    currentBoot: null,
    previousBoot: { available: false },
    assessment: { classification: "unknown", markers: [], inspectedEntries: 0 },
    source: {
      service: "openclaw-system-sense",
      transport: "journalctl_json",
      commands: [
        { command: "journalctl", args: BOOT_LIST_ARGS },
        { command: "journalctl", args: TERMINAL_ARGS },
      ],
      messagesIncluded: false,
      persistentEvidence: false,
    },
    governance: governance(),
    error: { code: errorCode, message: "Boot evidence is unavailable." },
    next: {
      recommendedSlice: "canonical-route-review",
      boundary: "boot evidence remains read-only and does not infer or execute recovery",
    },
  };
}

export function createSystemdBootEvidence({
  journalctlPath = "journalctl",
  timeoutMs = DEFAULT_TIMEOUT_MS,
  execFileAsync = defaultExecFileAsync,
  readFileAsync = defaultReadFileAsync,
  registry = SYSTEMD_BOOT_EVIDENCE_REGISTRY,
} = {}) {
  const boundedTimeoutMs = Math.max(1, Math.min(Number.parseInt(String(timeoutMs), 10) || DEFAULT_TIMEOUT_MS, 5000));

  async function buildSystemdBootEvidence() {
    let bootListResult;
    try {
      bootListResult = await execFileAsync(journalctlPath, BOOT_LIST_ARGS, {
        timeout: boundedTimeoutMs,
        maxBuffer: MAX_OUTPUT_BYTES,
        windowsHide: true,
      });
    } catch (error) {
      return { ...unavailableResponse(typeof error?.code === "string" ? error.code : "JOURNALCTL_FAILED"), registry };
    }

    const boots = parseBootRecords(bootListResult?.stdout);
    const listedCurrentBoot = boots.find((boot) => boot.index === 0) ?? boots.at(-1) ?? null;
    const previousBoot = boots.find((boot) => boot.index === -1) ?? null;
    let currentBootId = null;
    try {
      currentBootId = normaliseBootId(await readFileAsync(BOOT_ID_PATH, "utf8"));
    } catch {
      currentBootId = null;
    }

    let terminalEntries = [];
    let terminalErrorCode = null;
    try {
      const terminalResult = await execFileAsync(journalctlPath, TERMINAL_ARGS, {
        timeout: boundedTimeoutMs,
        maxBuffer: MAX_OUTPUT_BYTES,
        windowsHide: true,
      });
      terminalEntries = parseTerminalEntries(terminalResult?.stdout);
    } catch (error) {
      terminalErrorCode = typeof error?.code === "string" ? error.code : "JOURNALCTL_FAILED";
    }

    const assessment = classifyTerminalEntries(terminalEntries);
    return {
      ok: true,
      registry,
      mode: "read_only",
      available: boots.length > 0,
      currentBoot: listedCurrentBoot
        ? {
            ...listedCurrentBoot,
            idMatchesKernel: currentBootId === null || currentBootId === listedCurrentBoot.bootId,
          }
        : null,
      currentKernelBootId: currentBootId,
      previousBoot: previousBoot
        ? { ...previousBoot, available: true }
        : { available: false },
      bootCount: boots.length,
      assessment: {
        ...assessment,
        terminalReadAvailable: terminalErrorCode === null,
        errorCode: terminalErrorCode,
      },
      source: {
        service: "openclaw-system-sense",
        transport: "journalctl_json",
        commands: [
          { command: "journalctl", args: BOOT_LIST_ARGS },
          { command: "journalctl", args: TERMINAL_ARGS },
        ],
        messagesInspectedTransiently: true,
        messagesIncluded: false,
        persistentEvidence: false,
      },
      governance: governance(),
      next: {
        recommendedSlice: "canonical-route-review",
        boundary: "classification is bounded evidence, not proof of user intent or a recovery command",
      },
    };
  }

  return { buildSystemdBootEvidence };
}
