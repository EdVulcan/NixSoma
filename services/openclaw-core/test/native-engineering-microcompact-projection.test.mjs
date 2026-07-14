import test from "node:test";
import assert from "node:assert/strict";

import { buildNativeEngineeringMicrocompactProjection } from "../src/native-engineering-microcompact-projection.mjs";

const text = (value) => ({ type: "text", text: value });

test("microcompact projection elides historical tool results without mutating input", () => {
  const messages = [
    { role: "assistant", content: [text("old turn")] },
    { role: "toolResult", toolName: "cc_grep", callId: "call-1", content: [text("A".repeat(2_000))] },
    { role: "assistant", content: [text("middle turn")] },
    { role: "toolResult", toolName: "cc_glob", callId: "call-2", content: [text("B".repeat(2_000))] },
    { role: "assistant", content: [text("recent turn")] },
    { role: "toolResult", toolName: "cc_read", callId: "call-3", content: [text("C".repeat(2_000))] },
  ];
  const before = structuredClone(messages);

  const result = buildNativeEngineeringMicrocompactProjection({
    messages,
    thresholdChars: 1_000,
    protectRecentAssistantTurns: 1,
  });

  assert.equal(result.summary.changed, true);
  assert.equal(result.summary.compactedMessages, 1);
  assert.equal(result.messages[1].callId, "call-1");
  assert.match(result.messages[1].content[0].text, /historical cc_grep result/u);
  assert.equal(result.messages[5].content[0].text.length, 2_000);
  assert.deepEqual(messages, before);
  assert.notEqual(result.messages, messages);
  assert.equal(result.governance.mutatesPersistedLogs, false);
  assert.equal(result.governance.callsProvider, false);
});

test("microcompact projection protects verification evidence outside recent window", () => {
  const messages = [
    { role: "assistant", content: [text("old turn")] },
    {
      role: "toolResult",
      toolName: "cc_verify",
      evidenceKind: "verification_evidence",
      content: [text("V".repeat(2_000))],
    },
    { role: "assistant", content: [text("recent turn")] },
  ];

  const result = buildNativeEngineeringMicrocompactProjection({
    messages,
    protectRecentAssistantTurns: 0,
  });

  assert.equal(result.summary.changed, false);
  assert.equal(result.summary.protectedEvidenceMessages, 1);
  assert.equal(result.messages[1].content[0].text.length, 2_000);
});

test("microcompact projection protects trusted work-view association outside recent window", () => {
  const result = buildNativeEngineeringMicrocompactProjection({
    thresholdChars: 10,
    protectRecentAssistantTurns: 0,
    messages: [
      { role: "assistant", content: [{ type: "text", text: "old" }] },
      {
        role: "toolResult",
        toolName: "trusted_work_view",
        evidenceKind: "trusted_work_view_evidence",
        content: [{ type: "text", text: "status=bound ".repeat(20) }],
      },
      { role: "assistant", content: [{ type: "text", text: "new" }] },
    ],
  });

  assert.equal(result.summary.protectedEvidenceMessages, 1);
  assert.equal(result.summary.compactedMessages, 0);
  assert.match(result.messages[1].content[0].text, /status=bound/u);
});

test("microcompact projection rejects oversized message collections and text", () => {
  assert.throws(
    () => buildNativeEngineeringMicrocompactProjection({
      messages: Array.from({ length: 101 }, () => ({ role: "user", content: [] })),
    }),
    /at most 100 messages/u,
  );
  assert.throws(
    () => buildNativeEngineeringMicrocompactProjection({
      messages: [{ role: "toolResult", content: [text("X".repeat(500_001))] }],
    }),
    /exceeds 500000 characters/u,
  );
});
