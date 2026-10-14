/** Public sprint fixtures. Support choices are simulated history, never learner types. */
export const profiles = [
  { id: 'student-a1b2c3d4', label: 'Student A', pin: '111111', simulated: true,
    replaySupport: 'concrete-diagrams', recentDifficulty: 'Interpreting the apparent pencil position at the water boundary.' },
  { id: 'student-b1c2d3e4', label: 'Student B', pin: '222222', simulated: true,
    replaySupport: 'ordered-annotations', recentDifficulty: 'Following the ordered changes as a light ray crosses the boundary.' },
] as const;
