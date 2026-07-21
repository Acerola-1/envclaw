---
date: 2026-07-16
pr: 2097
feature: Reasoning effort slider
impact: Chat reasoning effort is selected from a discrete slider while preserving the existing per-session values, persistence, and run behavior.
---

The chat input keeps its brain toolbar button and opens a compact slider for
the existing default, none, minimal, low, medium, high, xhigh, and max levels.
MoA sessions continue to hide the control, and changing the slider still
affects only the active session's subsequent runs.

## Fork adaptation note

This fork exposes seven levels (default, none, minimal, low, medium, high,
xhigh) and does not carry the upstream `max` level or its liquid-handle
animation, so the slider `max` index is `options.length - 1`. The control is
gated by `!isCodingAgentSession` (this fork's coding-agent gate) rather than
the upstream MoA gate, since the fork has no MoA feature.

