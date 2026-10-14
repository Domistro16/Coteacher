export function VisualWatermark({ width, height, dark = false }: { width: number; height: number; dark?: boolean }) {
  const scale = width / 640 * .9;
  return <g className="lesson-watermark" aria-hidden="true" data-watermark="Coteacher" transform={`translate(${width - 108 * scale - 8} ${height - 8}) scale(${scale})`}>
    <rect x="-4" y="-17" width="108" height="21" rx="8" fill={dark ? '#ffffff' : '#242039'} opacity=".06"/>
    <path d="M 4 -12 L 4 -1 L 13 -6.5 Z" fill={dark ? '#edf6fa' : '#7040d8'} opacity=".65"/>
    <text x="98" y="0" textAnchor="end" fontSize="13" fontWeight="800" fill={dark ? '#edf6fa' : '#242039'} opacity=".6">coteacher.</text>
  </g>;
}
