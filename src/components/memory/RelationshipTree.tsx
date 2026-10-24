/**
 * #2 RELATIONSHIP INTELLIGENCE — indented hierarchy inferred from titles.
 * The whole section is marked INFERRED: it is EBEXTA Engine inference, not verified fact.
 */
import { MemorySection, TrustBadge, EmptyNote, Pill } from './MemoryShared'
import type { RelationshipMap, RelationshipNode } from '../../lib/companyMemory'

const ROLE_TONE: Record<RelationshipNode['decision_role'], 'accent' | 'success' | 'warning' | 'default'> = {
  'Economic Buyer':    'success',
  'Technical Approver': 'accent',
  'Champion':          'accent',
  'Influencer':        'default',
  'Gatekeeper':        'warning',
}

/** Build parent → children buckets, with anyone unrooted treated as a root. */
function buildTree(nodes: RelationshipNode[]) {
  const byName = new Map(nodes.map(n => [n.name.toLowerCase(), n]))
  const children = new Map<string, RelationshipNode[]>()
  const roots: RelationshipNode[] = []

  for (const n of nodes) {
    const parentKey = n.reports_to?.toLowerCase()
    if (parentKey && byName.has(parentKey) && parentKey !== n.name.toLowerCase()) {
      const list = children.get(parentKey) ?? []
      list.push(n)
      children.set(parentKey, list)
    } else {
      roots.push(n)
    }
  }
  return { roots, children }
}

function Node({ node, children, depth }: {
  node: RelationshipNode
  children: Map<string, RelationshipNode[]>
  depth: number
}) {
  const kids = children.get(node.name.toLowerCase()) ?? []
  return (
    <li className="relative" style={{ paddingLeft: depth === 0 ? 0 : 18 }}>
      {depth > 0 && (
        <span className="absolute left-[5px] top-0 bottom-0 w-px"
          style={{ background: 'var(--border-subtle)' }} aria-hidden />
      )}
      <div className="rounded-xl px-3 py-2.5 mb-2"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
              {node.name}
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{node.title}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Pill tone={ROLE_TONE[node.decision_role]}>{node.decision_role}</Pill>
            {node.approach_order < 99 && (
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold mono-val"
                style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}
                title={`Approach order: ${node.approach_order}`}
              >
                {node.approach_order}
              </span>
            )}
          </div>
        </div>
      </div>
      {kids.length > 0 && (
        <ul>
          {kids.map(k => <Node key={k.name} node={k} children={children} depth={depth + 1} />)}
        </ul>
      )}
    </li>
  )
}

export function RelationshipTree({
  map, generating, hasContacts, onGenerate,
}: {
  map: RelationshipMap | null
  generating: boolean
  hasContacts: boolean
  onGenerate: () => void
}) {
  const nodes = map?.hierarchy ?? []
  const { roots, children } = buildTree(nodes)

  return (
    <MemorySection
      id="relationships"
      icon="account_tree"
      title="Relationship Intelligence"
      subtitle="Who reports to whom, and who to approach first"
      action={<TrustBadge verified={false} />}
    >
      {generating ? (
        <EmptyNote>Inferring the hierarchy from titles…</EmptyNote>
      ) : !hasContacts ? (
        <EmptyNote>
          No named stakeholders on this company yet. Once a scan or a EBEXTA verification
          finds people, the hierarchy is inferred from their titles.
        </EmptyNote>
      ) : nodes.length === 0 ? (
        <div className="space-y-2">
          <EmptyNote>No hierarchy generated yet.</EmptyNote>
          <button onClick={onGenerate} className="ghost-btn px-3 py-1.5 rounded-lg text-[12px] font-semibold">
            Generate relationship map
          </button>
        </div>
      ) : (
        <>
          <ul>
            {roots.map(r => <Node key={r.name} node={r} children={children} depth={0} />)}
          </ul>
          {map?.approach_advice && (
            <div className="mt-3 rounded-xl px-3 py-2.5 flex gap-2.5"
              style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border-subtle)' }}>
              <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0"
                style={{ color: 'var(--accent-interactive)' }}>tips_and_updates</span>
              <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                {map.approach_advice}
              </p>
            </div>
          )}
          <p className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>
            Inferred from job titles only. EBEXTA never invents people — everyone shown was
            found on this company.
          </p>
        </>
      )}
    </MemorySection>
  )
}
