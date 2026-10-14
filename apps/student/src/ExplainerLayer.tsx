import { useId } from 'react';
import type { VisualLayer } from '@coteacher/shared';

/** Position on the approved M/L ray; no physical speed or inferred angle. */
export function rayTip(d: string, progress: number): { x: number; y: number } | undefined {
  if (/[^ML\d\s.,-]/.test(d)) return;
  const coordinates = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  if (!coordinates || coordinates.length < 4 || coordinates.length % 2) return;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < coordinates.length; i += 2) points.push({ x: coordinates[i], y: coordinates[i + 1] });
  const lengths = points.slice(1).map((point, i) => Math.hypot(point.x - points[i].x, point.y - points[i].y));
  let remaining = lengths.reduce((sum, length) => sum + length, 0) * progress;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i]) {
      const fraction = lengths[i] ? remaining / lengths[i] : 0;
      return { x: points[i].x + (points[i + 1].x - points[i].x) * fraction, y: points[i].y + (points[i + 1].y - points[i].y) * fraction };
    }
    remaining -= lengths[i];
  }
  return points.at(-1);
}

/** Reveal approved text without rewriting it or changing its accessible wording. */
export function WrittenLabel({ x, y, text, fill, fontSize = 16, progress, strong = false }: {
  x: number; y: number; text: string; fill: string; fontSize?: number; progress: number; strong?: boolean;
}) {
  const clip = useId();
  return <g data-build="label" data-build-progress={progress.toFixed(4)} opacity={Math.min(1, progress * 8)}>
    <defs><clipPath id={clip} clipPathUnits="objectBoundingBox"><rect width={progress} height="1"/></clipPath></defs>
    <text x={x} y={y} fill={fill} fontSize={fontSize} fontWeight={strong ? 800 : 400} clipPath={progress < 1 ? `url(#${clip})` : undefined}>{text}</text>
  </g>;
}

/** Ordered stages for the reviewed science catalog; geometry and wording stay in the package. */
export function layerBuildWindow(assetId: string, shape: VisualLayer): readonly [number, number] {
  if (shape.kind === 'rect') return [.02, .18];
  if (shape.kind === 'circle') return [.02, .16];
  if (shape.kind === 'path') {
    if (shape.stroke === '#b8bec9') return [.19, .42]; // real, straight pencil
    if (!shape.emphasis) return [.1, .22]; // boundary
    return assetId === 'refraction-pencil' ? [.43, .66] : [.22, .60];
  }
  if (/^1\./.test(shape.text)) return [.04, .18];
  if (/^2\./.test(shape.text)) return [.22, .43];
  if (/^3\./.test(shape.text)) return [.62, .77];
  if (shape.text === 'Air' || shape.text === 'Water') return [.1, .23];
  if (shape.text.startsWith('Grey:')) return [.32, .47];
  if (shape.text.startsWith('Gold:')) return [.56, .71];
  if (shape.y >= 300) return [.70, .84];
  if (shape.text === 'Light source') return [.08, .22];
  return shape.y < 70 ? [.03, .20] : [.61, .77];
}

export function ConstructedLayer({ shape, progress, arrowProgress }: { shape: VisualLayer; progress: number; arrowProgress: number }) {
  const props = { fill: shape.fill, stroke: shape.stroke, strokeWidth: 5, strokeLinecap: 'round' as const };
  if (shape.kind === 'text') return <WrittenLabel {...shape} fontSize={shape.text.length <= 20 ? 25 : 16} progress={progress} strong={/^[123]\./.test(shape.text)}/>;
  if (shape.kind === 'rect') return <rect {...props} x={shape.x} y={shape.y + shape.h * (1 - progress)} width={shape.w} height={shape.h * progress} opacity={progress} data-build="medium" data-build-progress={progress.toFixed(4)}/>;
  if (shape.kind === 'circle') return <circle {...props} cx={shape.x} cy={shape.y} r={shape.w * progress} opacity={progress} data-build="source" data-build-progress={progress.toFixed(4)}/>;
  // Catalog rays contain an additional move command for their arrowhead.
  // Separate it so the direction arrow is completed after the shaft arrives.
  const parts = shape.d.match(/[Mm][^Mm]*/g) ?? [shape.d];
  const tip = shape.emphasis && progress > 0 && progress < 1 ? rayTip(parts[0], progress) : undefined;
  return <g>{parts.map((d, index) => {
    const amount = index === 0 ? progress : arrowProgress;
    return <path key={index} {...props} d={d.trim()} pathLength="100" strokeDasharray="100 100" strokeDashoffset={(1 - amount) * 100}
      opacity={Math.min(1, amount * 8)} data-build={index ? 'arrow' : shape.emphasis ? 'ray' : 'reference'} data-build-progress={amount.toFixed(4)}/>;
  })}{tip && <circle cx={tip.x} cy={tip.y} r="7" fill={shape.stroke} opacity=".8" aria-hidden="true"/>}</g>;
}
