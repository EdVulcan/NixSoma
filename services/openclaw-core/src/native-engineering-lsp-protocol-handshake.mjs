import { pathToFileURL } from "node:url";

const LSP_PROTOCOL_VERSION = "2.0";

function frameJsonRpcMessage(message) {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

function responseObserved(stdoutText, id) {
  return new RegExp(`"id"\\s*:\\s*${id}`).test(stdoutText);
}

function parseJsonRpcFrames(stdoutText = "", { maxMessages = 16, maxBodyChars = 16 * 1024 } = {}) {
  const messages = [];
  let offset = 0;
  while (messages.length < maxMessages && offset < stdoutText.length) {
    const headerEnd = stdoutText.indexOf("\r\n\r\n", offset);
    if (headerEnd < 0) {
      break;
    }
    const header = stdoutText.slice(offset, headerEnd);
    const match = /Content-Length:\s*(\d+)/iu.exec(header);
    if (!match) {
      offset = headerEnd + 4;
      continue;
    }
    const length = Number.parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + length;
    if (!Number.isFinite(length) || length < 0 || bodyEnd > stdoutText.length) {
      break;
    }
    const body = stdoutText.slice(bodyStart, bodyEnd);
    if (body.length <= maxBodyChars) {
      try {
        messages.push(JSON.parse(body));
      } catch {
        messages.push({ parseError: true, bodyBytes: Buffer.byteLength(body, "utf8") });
      }
    } else {
      messages.push({ bodyTooLarge: true, bodyBytes: Buffer.byteLength(body, "utf8") });
    }
    offset = bodyEnd;
  }
  return messages;
}

function collectSymbolResponseLocations(value, counters = { uriCount: 0, rangeCount: 0 }, seenUris = new Set()) {
  if (!value || typeof value !== "object") {
    return counters;
  }
  if (typeof value.uri === "string" && !seenUris.has(value.uri)) {
    seenUris.add(value.uri);
    counters.uriCount += 1;
  }
  if (typeof value.targetUri === "string" && !seenUris.has(value.targetUri)) {
    seenUris.add(value.targetUri);
    counters.uriCount += 1;
  }
  for (const key of ["range", "targetRange", "targetSelectionRange", "selectionRange"]) {
    const range = value[key];
    if (range && typeof range === "object" && range.start && range.end) {
      counters.rangeCount += 1;
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectSymbolResponseLocations(item, counters, seenUris);
    }
  }
  return counters;
}

function hoverContentSummary(contents) {
  if (contents == null) {
    return { hoverContentKind: "none", hoverContentChars: 0 };
  }
  if (typeof contents === "string") {
    return { hoverContentKind: "string", hoverContentChars: contents.length };
  }
  if (Array.isArray(contents)) {
    return {
      hoverContentKind: "array",
      hoverContentChars: contents.reduce((total, item) => total + JSON.stringify(item ?? "").length, 0),
    };
  }
  if (typeof contents === "object") {
    return {
      hoverContentKind: contents.kind ?? "object",
      hoverContentChars: typeof contents.value === "string"
        ? contents.value.length
        : JSON.stringify(contents).length,
    };
  }
  return { hoverContentKind: typeof contents, hoverContentChars: String(contents).length };
}

function resultKind(value) {
  if (Array.isArray(value)) {
    return "array";
  }
  if (value === null) {
    return "null";
  }
  return typeof value;
}

function summariseSymbolResponse({ stdoutText = "", requestId = 3, method = "textDocument/definition" } = {}) {
  const messages = parseJsonRpcFrames(stdoutText);
  const response = messages.find((message) => message?.id === requestId) ?? null;
  if (!response) {
    return {
      observed: false,
      requestId,
      method,
      resultKind: "missing",
      resultCount: 0,
      uriCount: 0,
      rangeCount: 0,
      hoverContentKind: "none",
      hoverContentChars: 0,
      rawResultIncluded: false,
    };
  }
  if (response.error) {
    return {
      observed: true,
      requestId,
      method,
      hasError: true,
      errorCode: response.error.code ?? null,
      errorMessageChars: typeof response.error.message === "string" ? response.error.message.length : 0,
      resultKind: "error",
      resultCount: 0,
      uriCount: 0,
      rangeCount: 0,
      hoverContentKind: "none",
      hoverContentChars: 0,
      rawResultIncluded: false,
    };
  }
  const result = response.result ?? null;
  const resultEntries = Array.isArray(result)
    ? result
    : result === null
      ? []
      : [result];
  const locationCounters = collectSymbolResponseLocations(result);
  const hoverSummary = method === "textDocument/hover"
    ? hoverContentSummary(result?.contents)
    : { hoverContentKind: "none", hoverContentChars: 0 };
  return {
    observed: true,
    requestId,
    method,
    hasError: false,
    resultKind: resultKind(result),
    resultCount: resultEntries.length,
    uriCount: locationCounters.uriCount,
    rangeCount: locationCounters.rangeCount,
    ...hoverSummary,
    rawResultIncluded: false,
  };
}

export function shouldRunLspInitializeShutdownHandshake(metadata = {}) {
  return metadata.lifecycleAction === "handshake";
}

export function shouldRunLspSourceTransferHandshake(metadata = {}) {
  return metadata.lifecycleAction === "source_transfer";
}

export function shouldRunLspSymbolRequestHandshake(metadata = {}) {
  return metadata.lifecycleAction === "symbol_request";
}

export function createLspInitializeShutdownHandshake({ workspacePath = null } = {}) {
  const rootUri = workspacePath ? pathToFileURL(workspacePath).href : null;
  const messages = [
    {
      jsonrpc: LSP_PROTOCOL_VERSION,
      id: 1,
      method: "initialize",
      params: {
        processId: null,
        rootUri,
        capabilities: {},
        trace: "off",
      },
    },
    {
      jsonrpc: LSP_PROTOCOL_VERSION,
      id: 2,
      method: "shutdown",
      params: null,
    },
    {
      jsonrpc: LSP_PROTOCOL_VERSION,
      method: "exit",
      params: null,
    },
  ];

  function write(stdin) {
    for (const message of messages) {
      stdin.write(frameJsonRpcMessage(message));
    }
    stdin.end();
    return {
      mode: "initialize_shutdown_handshake_only",
      attempted: true,
      messagesSent: ["initialize", "shutdown", "exit"],
      requestIds: [1, 2],
      rootUri,
      sourceContentTransferred: false,
      didOpenSent: false,
      symbolRequestsSent: false,
    };
  }

  function summarise({ stdoutText = "", stderrText = "" } = {}) {
    const initializeResponseObserved = responseObserved(stdoutText, 1);
    const shutdownResponseObserved = responseObserved(stdoutText, 2);
    return {
      mode: "initialize_shutdown_handshake_only",
      attempted: true,
      messagesSent: ["initialize", "shutdown", "exit"],
      requestIds: [1, 2],
      rootUri,
      initializeResponseObserved,
      shutdownResponseObserved,
      ok: initializeResponseObserved && shutdownResponseObserved,
      stdoutBytes: Buffer.byteLength(stdoutText, "utf8"),
      stderrBytes: Buffer.byteLength(stderrText, "utf8"),
      sourceContentTransferred: false,
      didOpenSent: false,
      symbolRequestsSent: false,
    };
  }

  return {
    write,
    summarise,
  };
}

export function createLspInitializeDidOpenShutdownHandshake({
  workspacePath = null,
  sourceTransfer = {},
  sourceContent = {},
} = {}) {
  const rootUri = workspacePath ? pathToFileURL(workspacePath).href : null;
  const textDocument = {
    uri: sourceTransfer.uri ?? null,
    languageId: sourceTransfer.languageId ?? sourceTransfer.language ?? "typescript",
    version: 1,
    text: sourceContent.text ?? "",
  };
  const textBytes = sourceContent.textBytes ?? Buffer.byteLength(textDocument.text, "utf8");
  const textSha256 = sourceContent.textSha256 ?? sourceTransfer.textSha256 ?? null;
  const messages = [
    {
      jsonrpc: LSP_PROTOCOL_VERSION,
      id: 1,
      method: "initialize",
      params: {
        processId: null,
        rootUri,
        capabilities: {},
        trace: "off",
      },
    },
    {
      jsonrpc: LSP_PROTOCOL_VERSION,
      method: "textDocument/didOpen",
      params: {
        textDocument,
      },
    },
    {
      jsonrpc: LSP_PROTOCOL_VERSION,
      id: 2,
      method: "shutdown",
      params: null,
    },
    {
      jsonrpc: LSP_PROTOCOL_VERSION,
      method: "exit",
      params: null,
    },
  ];

  function write(stdin) {
    for (const message of messages) {
      stdin.write(frameJsonRpcMessage(message));
    }
    stdin.end();
    return {
      mode: "initialize_didopen_shutdown_only",
      attempted: true,
      messagesSent: ["initialize", "textDocument/didOpen", "shutdown", "exit"],
      requestIds: [1, 2],
      rootUri,
      didOpenSent: true,
      symbolRequestsSent: false,
      sourceContentTransferred: true,
      sourceTransfer: {
        relativePath: sourceTransfer.relativePath ?? null,
        uri: textDocument.uri,
        languageId: textDocument.languageId,
        textBytes,
        textSha256,
      },
    };
  }

  function summarise({ stdoutText = "", stderrText = "" } = {}) {
    const initializeResponseObserved = responseObserved(stdoutText, 1);
    const shutdownResponseObserved = responseObserved(stdoutText, 2);
    return {
      mode: "initialize_didopen_shutdown_only",
      attempted: true,
      messagesSent: ["initialize", "textDocument/didOpen", "shutdown", "exit"],
      requestIds: [1, 2],
      rootUri,
      initializeResponseObserved,
      shutdownResponseObserved,
      ok: initializeResponseObserved && shutdownResponseObserved,
      stdoutBytes: Buffer.byteLength(stdoutText, "utf8"),
      stderrBytes: Buffer.byteLength(stderrText, "utf8"),
      didOpenSent: true,
      symbolRequestsSent: false,
      sourceContentTransferred: true,
      sourceTransfer: {
        relativePath: sourceTransfer.relativePath ?? null,
        uri: textDocument.uri,
        languageId: textDocument.languageId,
        textBytes,
        textSha256,
      },
    };
  }

  return {
    write,
    summarise,
  };
}

export function createLspSymbolRequestHandshake({
  workspacePath = null,
  sourceTransfer = {},
  sourceContent = {},
  symbolRequest = {},
} = {}) {
  const rootUri = workspacePath ? pathToFileURL(workspacePath).href : null;
  const textDocument = {
    uri: sourceTransfer.uri ?? symbolRequest.uri ?? null,
    languageId: sourceTransfer.languageId ?? sourceTransfer.language ?? "typescript",
    version: 1,
    text: sourceContent.text ?? "",
  };
  const method = symbolRequest.method ?? "textDocument/definition";
  const textBytes = sourceContent.textBytes ?? Buffer.byteLength(textDocument.text, "utf8");
  const textSha256 = sourceContent.textSha256 ?? sourceTransfer.textSha256 ?? null;
  const messages = [
    {
      jsonrpc: LSP_PROTOCOL_VERSION,
      id: 1,
      method: "initialize",
      params: {
        processId: null,
        rootUri,
        capabilities: {},
        trace: "off",
      },
    },
    {
      jsonrpc: LSP_PROTOCOL_VERSION,
      method: "textDocument/didOpen",
      params: {
        textDocument,
      },
    },
    {
      jsonrpc: LSP_PROTOCOL_VERSION,
      id: 3,
      method,
      params: symbolRequest.params ?? {
        textDocument: { uri: textDocument.uri },
        position: { line: 0, character: 0 },
      },
    },
    {
      jsonrpc: LSP_PROTOCOL_VERSION,
      id: 4,
      method: "shutdown",
      params: null,
    },
    {
      jsonrpc: LSP_PROTOCOL_VERSION,
      method: "exit",
      params: null,
    },
  ];

  function write(stdin) {
    for (const message of messages) {
      stdin.write(frameJsonRpcMessage(message));
    }
    stdin.end();
    return {
      mode: "initialize_didopen_symbol_shutdown_only",
      attempted: true,
      messagesSent: ["initialize", "textDocument/didOpen", method, "shutdown", "exit"],
      requestIds: [1, 3, 4],
      rootUri,
      didOpenSent: true,
      symbolRequestsSent: true,
      symbolRequestMethod: method,
      symbolRequestId: 3,
      sourceContentTransferred: true,
      sourceTransfer: {
        relativePath: sourceTransfer.relativePath ?? null,
        uri: textDocument.uri,
        languageId: textDocument.languageId,
        textBytes,
        textSha256,
      },
    };
  }

  function summarise({ stdoutText = "", stderrText = "" } = {}) {
    const initializeResponseObserved = responseObserved(stdoutText, 1);
    const symbolResponseObserved = responseObserved(stdoutText, 3);
    const shutdownResponseObserved = responseObserved(stdoutText, 4);
    const symbolResponseSummary = summariseSymbolResponse({ stdoutText, requestId: 3, method });
    return {
      mode: "initialize_didopen_symbol_shutdown_only",
      attempted: true,
      messagesSent: ["initialize", "textDocument/didOpen", method, "shutdown", "exit"],
      requestIds: [1, 3, 4],
      rootUri,
      initializeResponseObserved,
      symbolResponseObserved,
      shutdownResponseObserved,
      ok: initializeResponseObserved && symbolResponseObserved && shutdownResponseObserved,
      stdoutBytes: Buffer.byteLength(stdoutText, "utf8"),
      stderrBytes: Buffer.byteLength(stderrText, "utf8"),
      didOpenSent: true,
      symbolRequestsSent: true,
      symbolRequestMethod: method,
      symbolRequestId: 3,
      symbolResponseSummary,
      sourceContentTransferred: true,
      sourceTransfer: {
        relativePath: sourceTransfer.relativePath ?? null,
        uri: textDocument.uri,
        languageId: textDocument.languageId,
        textBytes,
        textSha256,
      },
    };
  }

  return {
    write,
    summarise,
  };
}
