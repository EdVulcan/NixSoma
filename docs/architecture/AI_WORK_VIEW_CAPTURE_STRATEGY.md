# AI Work View Capture Strategy

This document defines the current Linux/NixOS capture direction for
OpenClawOnNixOS.

## Decision

The current mainline capture strategy is:

- prefer AI-owned work view capture
- prefer browser/runtime-backed state
- prefer external file/command providers that emit the stable capture contract

The current non-mainline capture strategy is:

- whole-desktop GNOME/Wayland capture

That whole-desktop path remains valuable for research, but it is not the
current delivery path for the MVP.

## Why

Real NixOS VM validation showed:

- control-plane services run correctly on NixOS
- state settling and degraded semantics work correctly on NixOS
- external command/file capture works correctly on NixOS
- GNOME/Wayland whole-desktop capture is not yet reliable enough to serve as
  the default provider

Observed issues include:

- `org.gnome.Shell.Screenshot` unavailable
- `org.gnome.Shell.Eval` unavailable or restricted
- `grim` present but not producing stable captures in the tested GNOME VM
- `gnome-screenshot` falling back to X11 and failing
- `xdg-desktop-portal Screenshot` triggering capture UX but not yielding a
  robust script-friendly result in the current VM workflow

## Product Alignment

This decision is also consistent with the OpenClaw product philosophy:

- OpenClaw should have its own work view
- OpenClaw should operate in the background without seizing the user's front
  view
- users should be able to reveal, observe, and take over that work view

That means the most valuable capture surface is not "the whole desktop at all
times" but "the AI-owned work surface that OpenClaw itself is driving."

## Mainline Provider Hierarchy

The recommended provider order for Linux/NixOS mainline work is:

1. browser/runtime-backed capture
2. file-backed command capture
3. custom work-view capture providers

Examples:

- a browser-owned capture endpoint
- a sidecar that writes screenshot and OCR files
- a nested compositor or dedicated AI session provider that emits the standard
  JSON contract

## Experimental Provider Hierarchy

The following remain experimental:

1. `xdg-desktop-portal Screenshot`
2. `org.gnome.Shell.Screenshot`
3. `grim`
4. `gnome-screenshot`
5. `import`

These are still worth keeping behind the adapter boundary, but they should not
block progress on the mainline control plane.

## Implementation Rule

For current development:

- do not block core milestones on whole-desktop GNOME capture
- do continue improving the adapter shell when low-cost opportunities appear
- do prioritize AI work-view capture and stable contract providers

## Practical Next Step

The next valuable Linux/NixOS work should focus on:

- making AI work-view capture richer
- improving browser/runtime state fidelity
- defining dedicated work-view capture providers
- integrating those providers cleanly with `openclaw-screen-sense`
