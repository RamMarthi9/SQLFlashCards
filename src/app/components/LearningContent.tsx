import type { ContentBlock, SectionId } from '../../content/catalog'

export function Icon({ kind, className }: { kind: SectionId | 'cards'; className?: string }) {
  return <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'definition' && <><path d="M24 12C17 6 10 7 5 10v29c6-3 12-3 19 2 7-5 13-5 19-2V10c-5-3-12-4-19 2Z" /><path d="M24 12v29" /></>}
    {kind === 'concept' && <><path d="M17 34c0-8-6-9-6-17a13 13 0 0 1 26 0c0 8-6 9-6 17ZM17 34h14v5a4 4 0 0 1-4 4h-6a4 4 0 0 1-4-4Z" /><path d="M24 1v-1M4 8l-2-2M44 8l2-2M4 23H1m43 0h3" /></>}
    {kind === 'examples' && <><rect x="3" y="5" width="30" height="24" rx="3" /><path d="M3 13h30" /><rect x="15" y="21" width="30" height="24" rx="3" /><path d="M15 29h30m-20 0v16m10-16v16M15 37h30" /></>}
    {kind === 'syntax' && <path d="m13 12-11 12 11 12m22-24 11 12-11 12M29 6 19 42" />}
    {kind === 'cards' && <><rect x="5" y="11" width="27" height="34" rx="5" fill="#c190ff" stroke="none" transform="rotate(-12 18 28)" /><rect x="14" y="5" width="27" height="35" rx="5" fill="#9550ed" stroke="#eee1ff" /><rect x="21" y="4" width="25" height="33" rx="5" fill="#6d19d5" stroke="#eee1ff" transform="rotate(10 33 20)" /><path d="m28 13 12 2m-13 5 11 2m-12 5 6 1" stroke="white" /></>}
  </svg>
}

export function JoinDiagram({ asset, alt }: { asset: string; alt: string }) {
  return <svg className="hero-diagram" viewBox="0 0 320 208" role="img" aria-label={alt}>
    {asset === 'left-join' ? <circle cx="116" cy="96" r="76" fill="#50f2b2" /> : <path d="M160 34.05a76 76 0 0 1 0 123.9 76 76 0 0 1 0-123.9Z" fill="#50f2b2" />}
    <circle cx="116" cy="96" r="76" fill="none" stroke="white" strokeWidth="5" /><circle cx="204" cy="96" r="76" fill="none" stroke="white" strokeWidth="5" />
    <text x="84" y="197" fill="white" fontSize="16">Left table</text><text x="199" y="197" fill="white" fontSize="16">Right table</text>
  </svg>
}

export function ContentBlocks({ blocks, label }: { blocks: ContentBlock[]; label: string }) {
  return <>{blocks.map((block, index) => {
    if (block.kind === 'text') return <p className="content-block" key={index}>{block.text}</p>
    if (block.kind === 'sql') return <figure className="sql-block" key={index}><figcaption>{block.dialect ?? 'SQL example'}</figcaption><pre tabIndex={0}><code>{block.code}</code></pre></figure>
    const tableNumber = blocks.slice(0, index + 1).filter((item) => item.kind === 'table').length
    return <div className="table-scroll" key={index} tabIndex={0} role="region" aria-label={`${label} table ${tableNumber}`}>
      <table><caption>{label} · Table {tableNumber}</caption><thead><tr>{block.columns.map((column, col) => <th scope="col" key={col}>{column}</th>)}</tr></thead>
        <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, col) => <td key={col}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  })}</>
}
