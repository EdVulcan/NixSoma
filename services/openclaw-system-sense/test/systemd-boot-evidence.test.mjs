import test from "node:test";
import assert from "node:assert/strict";

import {
  createSystemdBootEvidence,
  SYSTEMD_BOOT_EVIDENCE_REGISTRY,
} from "../src/systemd-boot-evidence.mjs";

const bootList = JSON.stringify([
  {
    index: -1,
    boot_id: "e534bb9974774bbc89e9e58099e89c0a",
    first_entry: 1785200863092296,
    last_entry: 1785339830068796,
  },
  {
    index: 0,
    boot_id: "e8a6a4fa094b43d5b43fd9ec584ec0e4",
    first_entry: 1785339841079902,
    last_entry: 1785475702487880,
  },
]);

test("boot evidence classifies an explicit systemd reboot without returning journal text", async () => {
  const calls = [];
  const { buildSystemdBootEvidence } = createSystemdBootEvidence({
    journalctlPath: "/nix/systemd/bin/journalctl",
    execFileAsync: async (command, args, options) => {
      calls.push({ command, args, options });
      return calls.length === 1
        ? { stdout: bootList }
        : {
            stdout: [
              JSON.stringify({
                _BOOT_ID: "e534bb9974774bbc89e9e58099e89c0a",
                _SYSTEMD_UNIT: "systemd-reboot.service",
                MESSAGE: "Finished System Reboot. password=do-not-return",
                SYSLOG_IDENTIFIER: "systemd",
              }),
              JSON.stringify({
                _SYSTEMD_UNIT: "systemd-shutdown.service",
                MESSAGE: "Using hardware watchdog /dev/watchdog0; Watchdog running with a hardware timeout",
                SYSLOG_IDENTIFIER: "systemd-shutdown",
              }),
              JSON.stringify({
                _SYSTEMD_UNIT: "systemd-shutdown.service",
                MESSAGE: "Sending SIGTERM to remaining processes",
                SYSLOG_IDENTIFIER: "systemd-shutdown",
              }),
            ].join("\n"),
          };
    },
    readFileAsync: async () => "e8a6a4fa-094b-43d5-b43f-d9ec584ec0e4\n",
  });

  const evidence = await buildSystemdBootEvidence();

  assert.equal(evidence.ok, true);
  assert.equal(evidence.registry, SYSTEMD_BOOT_EVIDENCE_REGISTRY);
  assert.equal(evidence.available, true);
  assert.equal(evidence.currentBoot.bootId, "e8a6a4fa094b43d5b43fd9ec584ec0e4");
  assert.equal(evidence.currentKernelBootId, "e8a6a4fa094b43d5b43fd9ec584ec0e4");
  assert.equal(evidence.currentBoot.idMatchesKernel, true);
  assert.equal(evidence.previousBoot.available, true);
  assert.equal(evidence.assessment.classification, "explicit_reboot_sequence");
  assert.deepEqual(evidence.assessment.markers, [
    "systemd_reboot_sequence",
    "systemd_shutdown_sequence",
  ]);
  assert.equal(evidence.source.messagesIncluded, false);
  assert.equal(evidence.governance.hostMutation, false);
  assert.equal(evidence.governance.persistentEvidence, false);
  assert.doesNotMatch(JSON.stringify(evidence), /do-not-return|Finished System Reboot/u);
  assert.deepEqual(calls[0].args, ["--no-pager", "--quiet", "--list-boots", "--output=json"]);
  assert.deepEqual(calls[1].args, [
    "--no-pager",
    "--quiet",
    "--boot=-1",
    "--output=json",
    "--reverse",
    "--lines",
    "64",
    "--output-fields=_BOOT_ID,__REALTIME_TIMESTAMP,_SYSTEMD_UNIT,SYSLOG_IDENTIFIER,MESSAGE_ID,MESSAGE,PRIORITY,_TRANSPORT",
  ]);
  assert.equal(calls[1].options.timeout, 2500);
});

test("boot evidence reports watchdog only for an abnormal watchdog marker", async () => {
  const { buildSystemdBootEvidence } = createSystemdBootEvidence({
    execFileAsync: async (_command, args) => ({
      stdout: args.includes("--list-boots")
        ? bootList
        : [
            {
              _SYSTEMD_UNIT: "systemd-reboot.service",
              MESSAGE: "Reached target System Reboot",
              SYSLOG_IDENTIFIER: "systemd",
            },
            {
              _SYSTEMD_UNIT: "systemd.service",
              MESSAGE: "watchdog timeout expired while waiting for the kernel",
              SYSLOG_IDENTIFIER: "systemd",
            },
          ].map((record) => JSON.stringify(record)).join("\n"),
    }),
    readFileAsync: async () => "e8a6a4fa094b43d5b43fd9ec584ec0e4",
  });

  const evidence = await buildSystemdBootEvidence();

  assert.equal(evidence.assessment.classification, "watchdog");
  assert.deepEqual(evidence.assessment.markers, [
    "systemd_reboot_sequence",
    "watchdog_marker",
  ]);
});

test("boot evidence reports unknown cause when the previous boot has no bounded marker", async () => {
  const { buildSystemdBootEvidence } = createSystemdBootEvidence({
    execFileAsync: async (_command, args) => ({
      stdout: args.includes("--list-boots")
        ? JSON.stringify([{
            index: 0,
            boot_id: "e8a6a4fa094b43d5b43fd9ec584ec0e4",
            first_entry: 1785339841079902,
            last_entry: 1785475702487880,
          }])
        : JSON.stringify({ _SYSTEMD_UNIT: "openclaw-core.service", MESSAGE: "healthy" }),
    }),
    readFileAsync: async () => "e8a6a4fa094b43d5b43fd9ec584ec0e4",
  });

  const evidence = await buildSystemdBootEvidence();

  assert.equal(evidence.assessment.classification, "unknown");
  assert.deepEqual(evidence.assessment.markers, []);
  assert.equal(evidence.previousBoot.available, false);
});

test("boot evidence fails closed without exposing journal command errors", async () => {
  const { buildSystemdBootEvidence } = createSystemdBootEvidence({
    execFileAsync: async () => {
      const error = new Error("journalctl secret=do-not-return");
      error.code = "EACCES";
      error.stderr = "password=do-not-return";
      throw error;
    },
  });

  const evidence = await buildSystemdBootEvidence();

  assert.equal(evidence.available, false);
  assert.equal(evidence.error.code, "EACCES");
  assert.doesNotMatch(JSON.stringify(evidence), /do-not-return|password=/u);
  assert.equal(evidence.governance.hostMutation, false);
});
