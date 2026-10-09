import type { VisualAsset } from '@coteacher/shared';

/** Safe declarative shapes: no injected SVG, scripts, remote images or fonts. */
export function ReplayVisual({ asset, elapsedMs = 0 }: { asset: VisualAsset; elapsedMs?: number }) {
  const phase = (Math.max(0, elapsedMs) % 3500) / 3500;
  return <figure className="replay-stage" data-visual-asset-id={asset.id}>
    <svg viewBox="0 0 640 360" role="img" aria-label={asset.title}>
      <title>{asset.title}</title><rect width="640" height="360" fill="#102433"/>
      {asset.layers.map((shape, index) => {
        const props = { fill: shape.fill, stroke: shape.stroke, strokeWidth: 5, strokeLinecap: 'round' as const };
        if (shape.kind === 'text') return <text key={index} x={shape.x} y={shape.y} fill={shape.fill} fontSize={shape.text.length <= 20 ? 25 : 16}>{shape.text}</text>;
        if (shape.kind === 'rect') return <rect key={index} {...props} x={shape.x} y={shape.y} width={shape.w} height={shape.h}/>;
        if (shape.kind === 'circle') return <circle key={index} {...props} cx={shape.x} cy={shape.y} r={shape.w}/>;
        return <g key={index}><path {...props} d={shape.d}/>{shape.emphasis && <path className="replay-emphasis" d={shape.d}
          fill="none" stroke="#ffffff" strokeWidth="7" pathLength="100" strokeDasharray="9 91" strokeDashoffset={-phase * 100}/>}</g>;
      })}
    </svg><figcaption>{asset.title}<details><summary>Read visual annotations</summary>
      <ul>{asset.layers.filter(shape => shape.kind === 'text').map((shape, index) => <li key={index}>{shape.text}</li>)}</ul>
    </details></figcaption>
  </figure>;
}
