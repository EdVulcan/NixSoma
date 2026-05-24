# Desktop Capture Contract v1

This document defines the first stable contract between `openclaw-screen-sense`
and any external desktop capture provider.

The goal is to keep platform-specific capture logic outside the core control
plane so Windows-hosted development can migrate to NixOS/Linux with minimal
changes.

## Scope

This contract is designed for:

- screenshot metadata
- OCR text extraction
- focused window reporting
- visible window reporting

It is intentionally small. It does not yet include:

- accessibility trees
- mouse cursor position
- UI element bounding boxes
- multi-monitor geometry
- pixel buffers
- input injection

## Transport

The capture provider may be invoked by:

- `OPENCLAW_SCREEN_CAPTURE_NODE_FILE`
- `OPENCLAW_SCREEN_CAPTURE_POWERSHELL_FILE`
- `OPENCLAW_SCREEN_CAPTURE_COMMAND`

The provider must write a single JSON object to stdout.

## Required JSON Shape

```json
{
  "source": "command-file",
  "snapshotPath": "D:/captures/frame.png",
  "snapshotText": "Window title and OCR summary",
  "focusedWindow": {
    "title": "Firefox",
    "pid": 1234
  },
  "windowList": [
    {
      "title": "Firefox",
      "pid": 1234
    }
  ],
  "ocrBlocks": [
    {
      "text": "Example Domain",
      "confidence": 0.98
    }
  ]
}
```

## Field Rules

### `source`
- Type: `string`
- Meaning: provider identity such as `browser`, `command-file`, `linux-grim`

### `snapshotPath`
- Type: `string | null`
- Meaning: path to the captured frame artifact when available
- It may point to:
  - a text file
  - a png/jpg image
  - another generated capture artifact

### `snapshotText`
- Type: `string | null`
- Meaning: human-readable summary of the captured frame
- This is what `screen-sense` can surface immediately even when no image viewer
  is attached

### `focusedWindow`
- Type: object or `null`
- Fields:
  - `title: string`
  - `pid?: number`

### `windowList`
- Type: array or `null`
- Each item:
  - `title: string`
  - `pid?: number`

### `ocrBlocks`
- Type: array or `null`
- Each item:
  - `text: string`
  - `confidence?: number`

## Readiness Expectations

If a provider returns a valid capture payload, `openclaw-screen-sense` may treat
that capture as a usable screen source even when browser/session-derived state
is incomplete.

That is the key to low-friction migration:

- system-specific capture lives outside core services
- core services consume one stable contract
- migration mostly becomes "replace the provider"

## Migration Guidance

### Windows development

Current practical providers:

- browser-backed mock capture
- Node file-backed capture
- PowerShell capture helper

### NixOS / Linux target

Likely providers:

- `xdg-desktop-portal Screenshot` for GNOME/Wayland-friendly screenshots
- `org.gnome.Shell.Screenshot` via `gdbus` for GNOME screenshots
- `grim` for screenshots
- `gnome-screenshot` for GNOME-based screenshots
- `slurp` for region selection when needed
- `tesseract` for OCR
- `gdbus` against `org.gnome.Shell` for focused window / window list on GNOME
- `swaymsg`, `hyprctl`, `wmctrl`, or compositor-specific tools for focused window / window list

As long as the Linux collector emits the JSON shape above, the rest of the
OpenClaw control plane should not need major changes.
