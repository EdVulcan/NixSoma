export function observerStyles() {
  return `      :root {
        color-scheme: dark;
        --bg: #0b1020;
        --panel: #121932;
        --line: #2b3568;
        --text: #e6ebff;
        --muted: #9aa7d6;
        --accent: #6ee7c8;
        --warn: #ffcc66;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", "Noto Sans", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(110, 231, 200, 0.12), transparent 30%),
          linear-gradient(180deg, #08101d, var(--bg));
        color: var(--text);
      }
      main {
        max-width: 1320px;
        margin: 0 auto;
        padding: 24px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 32px;
      }
      .subtitle {
        margin: 0 0 24px;
        color: var(--muted);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
      }
      .panel {
        background: rgba(18, 25, 50, 0.9);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 16px;
        box-shadow: 0 14px 40px rgba(0, 0, 0, 0.24);
      }
      .panel h2 {
        margin: 0 0 12px;
        font-size: 18px;
      }
      .metric {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin: 8px 0;
      }
      .metric span:last-child {
        color: var(--accent);
      }
      .actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
      .actions.tight {
        gap: 8px;
      }
      .control-stack {
        display: grid;
        gap: 12px;
      }
      .field {
        display: grid;
        gap: 6px;
      }
      .field label {
        color: var(--muted);
        font-size: 13px;
      }
      .field input {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: rgba(10, 16, 34, 0.9);
        color: var(--text);
        padding: 10px 12px;
        font: inherit;
      }
      button {
        border: 0;
        border-radius: 999px;
        background: var(--accent);
        color: #04111c;
        padding: 10px 16px;
        font-weight: 700;
        cursor: pointer;
      }
      button.secondary {
        background: transparent;
        color: var(--text);
        border: 1px solid var(--line);
      }
      pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        color: var(--muted);
        font-size: 13px;
      }
      ul {
        margin: 0;
        padding-left: 18px;
      }
      li {
        margin: 6px 0;
      }
      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        padding: 4px 10px;
        background: rgba(110, 231, 200, 0.12);
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
      }
      .status-pill.warn {
        background: rgba(255, 204, 102, 0.14);
        color: var(--warn);
      }
      .task-list {
        display: grid;
        gap: 12px;
      }
      .task-card {
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 12px;
        background: rgba(10, 16, 34, 0.66);
      }
      .task-card.selected {
        border-color: var(--accent);
        box-shadow: 0 0 0 1px rgba(110, 231, 200, 0.35);
      }
      .task-card.active {
        border-color: rgba(110, 231, 200, 0.6);
      }
      .task-card h3 {
        margin: 0 0 8px;
        font-size: 14px;
      }
      .task-card-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 10px;
      }
      .task-card-actions button {
        padding: 8px 12px;
        font-size: 12px;
      }
      .task-card-top {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
      }
      .task-card-top h3 {
        flex: 1;
      }
      .task-status-group {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .task-section {
        display: grid;
        gap: 12px;
      }
      .task-section h3 {
        margin: 0;
        font-size: 13px;
        color: var(--muted);
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .task-summary-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px 14px;
        margin-bottom: 14px;
      }
      .task-summary-grid .metric {
        margin: 0;
      }
      .hint {
        color: var(--muted);
        font-size: 12px;
      }
      .detail-meta {
        margin-top: 12px;
        margin-bottom: 12px;
        color: var(--muted);
        font-size: 12px;
      }
`;
}
