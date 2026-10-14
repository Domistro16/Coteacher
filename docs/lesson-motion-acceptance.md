# Five-second instructional motion acceptance

2026-10-12. Preserve package/recording contracts, approved content/geometry,
learning objectives and A/B variants. Changes affect rendering and ephemeral
display clocks, not source material or saved recording timestamps.

- Full visual construction replaces the earlier finished-diagram overlay. Sources,
  media, rays, direction arrows and text reveal in teaching order; numbered variants
  build each instruction; pencil variants build separate real/apparent positions
  without bending the pencil. See explainer-animation-acceptance.md.
- All normal-motion visual cycles are 5,000 ms. Native audio position minus the
  actual cue offset controls recorded visuals. Pause freezes and seeking selects
  the correct phase, including equal-time cues and returning from help.
- Studio/projector share an authoritative clock: ambient presentation time before
  capture and actual captured-sample/cue time during recording. Local communication
  needs no network; pause/reconnection cannot drift into a separate animation clock.
- Enter transitions occur on visual identity changes, not every timer update.
  Reduced motion disables loops/transitions and retains readable static instruction.
- Small SVG watermarks occupy reserved space at every visual's bottom-right.
  Existing annotations, control bounds and accessible image descriptions remain.
- Run browser checks through native capture/projector/review/publication/A+B
  offline playback, deterministic phase/seek/pause and reduced-motion checks.
  Run contracts, TypeScript, units, builds and demo validation. Report hardware
  and human-recording limitations honestly; no fake successful delivery/AI.
