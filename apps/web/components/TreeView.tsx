'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

interface TreeNode {
  id: string;
  masked: boolean;
  displayName: string;
  gender?: string;
  years?: string | null;
  livingStatus?: string;
  generationRecorded?: number | null;
  siblingOrder?: number | null;
  isLineage: boolean;
}

export interface TreeData {
  rootId: string;
  nodes: TreeNode[];
  edges: { parentId: string; childId: string; type: string }[];
  unions: { id: string; partner1Id: string; partner2Id: string; unionLabel: string | null }[];
}

/**
 * Cây phả hệ dạng danh sách thụt lề: đọc được bằng bàn phím và trình đọc màn hình,
 * thu gọn/mở rộng từng nhánh (chế độ xem thay thế bắt buộc ở mục 2.1(5)).
 */
export function TreeView({ data, familyId }: { data: TreeData; familyId: string }) {
  const { byId, children, spouses } = useMemo(() => {
    const byId = new Map(data.nodes.map((n) => [n.id, n]));
    const children = new Map<string, string[]>();
    const seen = new Set<string>();
    for (const e of data.edges) {
      // Mỗi người chỉ hiển thị một lần dưới cha/mẹ thuộc dòng họ đầu tiên
      if (seen.has(e.childId)) continue;
      seen.add(e.childId);
      children.set(e.parentId, [...(children.get(e.parentId) ?? []), e.childId]);
    }
    // Con trưởng trước, người chưa rõ thứ tự xếp sau; cùng thứ tự thì theo tên
    const order = (id: string) => byId.get(id)?.siblingOrder ?? Number.MAX_SAFE_INTEGER;
    for (const list of children.values()) {
      list.sort((a, b) => order(a) - order(b) || (byId.get(a)?.displayName ?? '').localeCompare(byId.get(b)?.displayName ?? '', 'vi'));
    }
    const spouses = new Map<string, { id: string; label: string | null }[]>();
    for (const u of data.unions) {
      for (const [a, b] of [[u.partner1Id, u.partner2Id], [u.partner2Id, u.partner1Id]]) {
        if (byId.get(a)?.isLineage) spouses.set(a, [...(spouses.get(a) ?? []), { id: b, label: u.unionLabel }]);
      }
    }
    return { byId, children, spouses };
  }, [data]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const renderNode = (id: string, depth: number, path: Set<string>): React.ReactNode => {
    const node = byId.get(id);
    if (!node || path.has(id)) return null;
    const kids = children.get(id) ?? [];
    const isCollapsed = collapsed.has(id);
    const nextPath = new Set(path).add(id);
    return (
      <li key={id} role="treeitem" aria-expanded={kids.length ? !isCollapsed : undefined} aria-selected={false}>
        <div className="flex flex-wrap items-center gap-2 rounded-lg py-1.5 hover:bg-gold-soft/60">
          {kids.length ? (
            <button
              onClick={() => toggle(id)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-white font-bold text-primary"
              aria-label={isCollapsed ? `Mở nhánh ${node.displayName}` : `Thu gọn nhánh ${node.displayName}`}
            >
              {isCollapsed ? '+' : '−'}
            </button>
          ) : (
            <span className="inline-block w-9" aria-hidden />
          )}
          <PersonChip node={node} familyId={familyId} />
          {spouses.get(id)?.map((s) => {
            const sp = byId.get(s.id);
            return sp ? (
              <span key={s.id} className="flex items-center gap-1 text-muted">
                <span aria-hidden>⚭</span>
                <span className="sr-only">kết hôn với</span>
                <PersonChip node={sp} familyId={familyId} subtle />
                {s.label && <span className="text-sm">({s.label})</span>}
              </span>
            ) : null;
          })}
          {kids.length > 0 && <span className="text-sm text-muted">{kids.length} con</span>}
        </div>
        {kids.length > 0 && !isCollapsed && (
          <ul role="group" className="ml-4 border-l-2 border-gold/40 pl-4">
            {kids.map((k) => renderNode(k, depth + 1, nextPath))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <ul role="tree" aria-label="Cây phả hệ" className="text-lg">
      {renderNode(data.rootId, 0, new Set())}
    </ul>
  );
}

function PersonChip({ node, familyId, subtle }: { node: TreeNode; familyId: string; subtle?: boolean }) {
  if (node.masked) return <span className="italic text-muted">{node.displayName}</span>;
  const symbol = node.gender === 'female' ? '♀' : node.gender === 'male' ? '♂' : '';
  return (
    <Link
      href={`/families/${familyId}/persons/${node.id}`}
      className={`rounded px-1 underline-offset-4 hover:underline ${subtle ? '' : 'font-semibold text-ink'}`}
    >
      {node.generationRecorded && !subtle ? <span className="mr-1 text-sm text-gold">Đời {node.generationRecorded}</span> : null}
      {node.displayName}
      {symbol && <span className="ml-1 text-sm text-muted" aria-label={node.gender === 'female' ? 'nữ' : 'nam'}>{symbol}</span>}
      {node.years && <span className="ml-1 text-sm font-normal text-muted">({node.years})</span>}
    </Link>
  );
}
