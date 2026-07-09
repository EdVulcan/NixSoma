import { pathToFileURL } from "node:url";

const LSP_PROTOCOL_VERSION = "2.0";

function frameJsonRpcMessage(message) {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

function responseObserved(stdoutText, id) {
  return new RegExp(`"id"\\s*:\\s*${id}`).test(stdoutText);
}

export function shouldRunLspInitializeShutdownHandshake(metadata = {}) {
  return metadata.lifecycleAction === "handshake";
}

export function shouldRunLspSourceTransferHandshake(metadata = {}) {
  return metadata.lifecycleAction === "source_transfer";
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
