import { describe, expect, it } from 'vitest';
import { lessonMotion, lessonMotionLoopMs, explainerMotion } from '../apps/student/src/lesson-motion';
import { layerBuildWindow, rayTip } from '../apps/student/src/ExplainerLayer';
import { visualCatalog } from '@coteacher/shared';
import { isPresentationMotion } from '../apps/teacher/src/projector-channel';

describe('media-driven instructional motion', () => {
  it('revisits the exact same frame every five seconds, including long recordings', () => {
    expect(lessonMotionLoopMs).toBe(5000);
    for (const offset of [0, 800, 1750, 2750, 4500, 4999]) {
      expect(lessonMotion(offset + 5000)).toEqual(lessonMotion(offset));
      expect(lessonMotion(offset + 3600000)).toEqual(lessonMotion(offset));
    }
  });
  it('clamps invalid/pre-cue time and restarts deterministically at a cue', () => {
    for (const invalid of [-100, NaN, Infinity]) expect(lessonMotion(invalid)).toEqual(lessonMotion(0));
    expect(lessonMotion(6300 - 5500).phase).toBe(.16);
  });
  it('constructs every approved layer from absent to complete, then holds and resets', () => {
    for (const asset of visualCatalog()) for (const shape of asset.layers) {
      const [start, end] = layerBuildWindow(asset.id, shape);
      expect(explainerMotion(0).progress(start, end)).toBe(0);
      expect(explainerMotion(4500).progress(start, end)).toBe(1);
      expect(explainerMotion(4500).opacity).toBe(1);
      let previous = 0;
      for (let time = 0; time <= 4500; time += 50) {
        const amount = explainerMotion(time).progress(start, end);
        expect(amount).toBeGreaterThanOrEqual(previous); expect(amount).toBeLessThanOrEqual(1); previous = amount;
        expect(explainerMotion(time + 5000).progress(start, end)).toBe(amount);
      }
      expect(explainerMotion(5000).progress(start, end)).toBe(0);
      expect(explainerMotion(0, true).progress(start, end)).toBe(1);
    }
    expect(explainerMotion(4999).opacity).toBeLessThan(.001);
  });
  it('introduces the real pencil before its separate apparent position and keeps numbered steps ordered', () => {
    const pencil = visualCatalog().find(asset => asset.id === 'refraction-pencil')!;
    const real = pencil.layers.find(shape => shape.stroke === '#b8bec9')!;
    const apparent = pencil.layers.find(shape => shape.emphasis)!;
    expect(layerBuildWindow(pencil.id, real)[1]).toBeLessThan(layerBuildWindow(pencil.id, apparent)[0]);
    expect(real.d).toBe('M 145 65 L 290 280');
    for (const asset of visualCatalog().filter(asset => asset.id.endsWith('-steps'))) {
      const steps = asset.layers.filter(shape => /^[123]\./.test(shape.text));
      expect(steps).toHaveLength(3);
      const starts = steps.map(shape => layerBuildWindow(asset.id, shape)[0]);
      expect(starts[0]).toBeLessThan(starts[1]); expect(starts[1]).toBeLessThan(starts[2]);
    }
  });
  it('rejects malformed projector clocks instead of inventing a phase', () => {
    expect(isPresentationMotion({ stepId: 'step-light', elapsedMs: 800, running: false })).toBe(true);
    for (const value of [null, {}, { stepId: 'step-light', elapsedMs: NaN, running: true },
      { stepId: 'step-light', elapsedMs: -1, running: true }, { stepId: 'step-light', elapsedMs: 5, running: 'yes' }]) expect(isPresentationMotion(value)).toBe(false);
  });
  it('keeps the construction highlight on the existing ray through the boundary', () => {
    const path = 'M 350 60 L 465 145 L 505 280';
    expect(rayTip(path, 0)).toEqual({ x: 350, y: 60 });
    expect(rayTip(path, 1)).toEqual({ x: 505, y: 280 });
    const firstLength = Math.hypot(115, 85), lastLength = Math.hypot(40, 135);
    expect(rayTip(path, firstLength / (firstLength + lastLength))).toEqual({ x: 465, y: 145 });
    expect(rayTip('M0 0 Q10 10 20 20', .5)).toBeUndefined();
  });
});
