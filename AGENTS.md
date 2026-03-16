# Workspace Instructions

## Thread Continuity
- When the active thread is likely approaching the context limit, proactively produce a compact handoff summary before the limit is reached.
- The handoff summary must capture: current objective, decisions already made, important constraints, files touched, pending work, and the exact next step for the new thread.
- If the work involves an external tool or platform, include the current operating assumptions, prompt strategy, and any reusable wording or assets needed to continue in a fresh thread.
- Prefer placing the handoff summary in the assistant response itself so the user can copy it directly into a new thread without extra cleanup.
- If a local document is explicitly requested by the user for continuity, also write the same handoff summary to a workspace file named `THREAD_HANDOFF.md`.
