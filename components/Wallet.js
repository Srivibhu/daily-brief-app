// Water lilies and pearl bags, drawn as tiny pixel icons with their counts
const LILY = ['..#..#..', '.##.###.', '########', '###..###', '.######.']
const PEARL = ['..###...', '.#..##..', '#.#..##.', '#....##.', '.#####..']
function Ico({ rows, fill }) {
  return (
    <svg className="w-ico" viewBox={`0 0 ${rows[0].length} ${rows.length}`} width={rows[0].length * 2} height={rows.length * 2} shapeRendering="crispEdges" aria-hidden="true">
      {rows.flatMap((r, y) => [...r].map((c, x) => c === '#' ? <rect key={x + '-' + y} x={x} y={y} width="1" height="1" fill={fill} /> : null))}
    </svg>
  )
}
export const LilyIcon = () => <Ico rows={LILY} fill="#3f8a34" />
export const PearlIcon = () => <Ico rows={PEARL} fill="#8d8aa6" />

export default function Wallet({ lilies = 0, pearls = 0, className = '' }) {
  return (
    <span className={`wallet ${className}`} aria-label={`${lilies} water lilies, ${pearls} bags of pearls`}>
      <span className="w-item"><LilyIcon />{lilies}</span>
      <span className="w-item"><PearlIcon />{pearls}</span>
    </span>
  )
}
