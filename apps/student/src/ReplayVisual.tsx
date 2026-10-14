import { useId } from 'react';
import type { VisualAsset } from '@coteacher/shared';
import { explainerMotion, lessonMotionLoopMs } from './lesson-motion';
import { ConstructedLayer, layerBuildWindow } from './ExplainerLayer';
import { useReducedVisualMotion, useVisualTime } from './useVisualTime';
import { VisualWatermark } from './VisualWatermark';

/** Safe declarative shapes: no injected SVG, scripts, remote images or fonts. */
export function ReplayVisual({ asset, elapsedMs, compact = false, readable = false }: { asset: VisualAsset; elapsedMs?: number; compact?: boolean; readable?: boolean }) {
  const descriptionId = useId();
  const annotations = asset.layers.filter(shape => shape.kind === 'text');
  const reduced = useReducedVisualMotion();
  const { surface, time } = useVisualTime(asset.id, elapsedMs, !reduced);
  const motion = explainerMotion(reduced ? 0 : time, reduced);
  return <figure ref={surface} className="replay-stage" data-visual-asset-id={asset.id} data-source-refs={asset.sourceRefs.join(' ')}>
    <svg key={asset.id} className="lesson-motion-enter" data-motion-loop-ms={lessonMotionLoopMs} data-motion-phase={motion.phase.toFixed(5)} data-motion-time-ms={Math.round(time)} data-reduced-motion={reduced}
      viewBox="0 0 640 360" role="img" aria-label={asset.title} aria-describedby={descriptionId}>
      <title>{asset.title}</title><desc id={descriptionId}>{annotations.map(shape => shape.text).join(' ')}</desc><rect width="640" height="360" fill="#102433"/>
      <g transform="translate(12 4) scale(.94)" opacity={motion.opacity}>{asset.layers.map((shape, index) => {
        const [start, end] = layerBuildWindow(asset.id, shape);
        return <ConstructedLayer key={index} shape={shape} progress={motion.progress(start, end)} arrowProgress={motion.progress(.60, .70)}/>;
      })}</g><VisualWatermark width={640} height={360} dark/>
    </svg><figcaption hidden={compact && !readable} className={compact && readable ? 'readable-visual-notes' : undefined}><span className={compact ? 'sr-only' : undefined}>{asset.title}</span><details><summary>Read visual annotations</summary>
      <ul>{annotations.map((shape, index) => <li key={index}>{shape.text}</li>)}</ul>
    </details></figcaption>
  </figure>;
}
