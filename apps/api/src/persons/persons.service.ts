import {
  BadRequestException,
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FlexibleDateInput, StoredDate, toStoredDate } from '../common/flexible-date';
import { DB, Db, Queryable } from '../db/db';
import { FamilyContext } from '../families/access';
import { daysBetween, nextAnniversary, toIso } from '../lunar/lunar';
import { PersonRow, present } from './policy';

export interface NameInput {
  type: 'birth' | 'taboo' | 'courtesy' | 'pen' | 'posthumous' | 'other';
  valueVi: string;
  valueHanNom: string | null;
  isPrimary: boolean;
}

export interface PersonInput {
  gender: 'male' | 'female' | 'unknown';
  livingStatus: 'alive' | 'deceased' | 'unknown';
  names: NameInput[];
  generationRecorded: number | null;
  siblingOrder: number | null;
  siblingOrderNote: 'unknown' | 'twin' | null;
  isAnonymous: boolean;
  birthDate: FlexibleDateInput | null;
  deathDate: FlexibleDateInput | null;
  biography: string | null;
}

export type PersonPatch = Partial<Omit<PersonInput, 'names'>> & { version: number };

interface DbPerson extends PersonRow {
  family_id: string;
  gender: string;
  generation_recorded: number | null;
  sibling_order: number | null;
  sibling_order_note: string | null;
  is_anonymous: boolean;
  birth_date: StoredDate | null;
  death_date: StoredDate | null;
  biography: string | null;
  version: number;
  names: { id: string; type: string; valueVi: string; valueHanNom: string | null; isPrimary: boolean }[];
}

const PERSON_SELECT = `
  SELECT p.*,
         COALESCE((SELECT json_agg(json_build_object('id', n.id, 'type', n.type, 'valueVi', n.value_vi,
                                                    'valueHanNom', n.value_han_nom, 'isPrimary', n.is_primary)
                                   ORDER BY n.is_primary DESC, n.type)
                     FROM person_names n WHERE n.person_id = p.id), '[]'::json) AS names,
         EXISTS (SELECT 1 FROM erasure_registry e WHERE e.target_type = 'person' AND e.target_id = p.id) AS erased
    FROM persons p`;

/** Các cột được ghi lịch sử và có thể khôi phục. */
const PATCHABLE: Record<keyof Omit<PersonPatch, 'version'>, string> = {
  gender: 'gender',
  livingStatus: 'living_status',
  generationRecorded: 'generation_recorded',
  siblingOrder: 'sibling_order',
  siblingOrderNote: 'sibling_order_note',
  isAnonymous: 'is_anonymous',
  birthDate: 'birth_date',
  deathDate: 'death_date',
  biography: 'biography',
};

@Injectable()
export class PersonsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  // ---------- Đọc ----------

  async list(ctx: FamilyContext, search?: string) {
    const rows = await this.db.query<DbPerson>(`${PERSON_SELECT} WHERE p.family_id = $1 ORDER BY p.generation_recorded NULLS LAST, p.created_at`, [ctx.familyId]);
    const needle = search ? fold(search) : null;
    return rows
      .filter((r) => !needle || r.names.some((n) => fold(n.valueVi).includes(needle)))
      .map((r) => present(r, this.view(r), ctx))
      // Kết quả tìm kiếm không được lộ người bị che (mục 5.5)
      .filter((v) => v && !(needle && v.masked));
  }

  async get(ctx: FamilyContext, personId: string) {
    const row = await this.load(this.db, ctx.familyId, personId);
    const view = row && present(row, this.view(row), ctx);
    if (!view) throw new NotFoundException('Không tìm thấy người này');
    if (view.masked) return view;
    const [parents, children, unions] = await Promise.all([
      this.db.query(`SELECT id, parent_id AS "personId", type FROM parent_child WHERE child_id = $1`, [personId]),
      this.db.query(`SELECT id, child_id AS "personId", type FROM parent_child WHERE parent_id = $1`, [personId]),
      this.db.query(
        `SELECT id, CASE WHEN partner1_id = $1 THEN partner2_id ELSE partner1_id END AS "personId",
                union_order AS "unionOrder", union_label AS "unionLabel", end_reason AS "endReason"
           FROM unions WHERE partner1_id = $1 OR partner2_id = $1 ORDER BY union_order NULLS LAST`,
        [personId],
      ),
    ]);
    const related = await this.summaries(ctx, [...parents, ...children, ...unions].map((r: any) => r.personId));
    const attach = (list: any[]) => list.filter((r) => related.has(r.personId)).map((r) => ({ ...r, person: related.get(r.personId) }));
    return { ...view, parents: attach(parents), children: attach(children), unions: attach(unions) };
  }

  /** Cây hậu duệ từ một người gốc, kèm phối ngẫu; đã áp policy. */
  async tree(ctx: FamilyContext, rootId: string, maxDepth = 12) {
    const ids = await this.db.query<{ id: string; depth: number }>(
      `WITH RECURSIVE d(id, depth) AS (
         SELECT $2::uuid, 0
         UNION
         SELECT pc.child_id, d.depth + 1 FROM parent_child pc JOIN d ON pc.parent_id = d.id
          WHERE pc.family_id = $1 AND d.depth < $3
       )
       SELECT id, min(depth) AS depth FROM d GROUP BY id`,
      [ctx.familyId, rootId, maxDepth],
    );
    if (!ids.length) throw new NotFoundException();
    const lineage = ids.map((r) => r.id);
    const spouses = await this.db.query<{ id: string }>(
      `SELECT DISTINCT CASE WHEN partner1_id = ANY($2::uuid[]) THEN partner2_id ELSE partner1_id END AS id
         FROM unions WHERE family_id = $1 AND (partner1_id = ANY($2::uuid[]) OR partner2_id = ANY($2::uuid[]))`,
      [ctx.familyId, lineage],
    );
    const all = [...new Set([...lineage, ...spouses.map((s) => s.id)])];
    const rows = await this.db.query<DbPerson>(`${PERSON_SELECT} WHERE p.family_id = $1 AND p.id = ANY($2::uuid[])`, [ctx.familyId, all]);
    const nodes = new Map<string, any>();
    for (const r of rows) {
      const v = present(r, this.view(r), ctx);
      if (v) nodes.set(r.id, v);
    }
    if (!nodes.has(rootId)) throw new NotFoundException();

    const edges = (await this.db.query<{ parentId: string; childId: string; type: string }>(
      `SELECT parent_id AS "parentId", child_id AS "childId", type FROM parent_child
        WHERE family_id = $1 AND parent_id = ANY($2::uuid[]) AND child_id = ANY($2::uuid[])`,
      [ctx.familyId, lineage],
    )).filter((e) => nodes.has(e.parentId) && nodes.has(e.childId));
    const unions = (await this.db.query<{ id: string; partner1Id: string; partner2Id: string; unionOrder: number | null; unionLabel: string | null }>(
      `SELECT id, partner1_id AS "partner1Id", partner2_id AS "partner2Id", union_order AS "unionOrder", union_label AS "unionLabel"
         FROM unions WHERE family_id = $1 AND partner1_id = ANY($2::uuid[]) AND partner2_id = ANY($2::uuid[])`,
      [ctx.familyId, all],
    )).filter((u) => nodes.has(u.partner1Id) && nodes.has(u.partner2Id));

    // Chỉ giữ người còn nối được với gốc sau khi đã ẩn người bị policy loại bỏ
    const reachable = new Set([rootId]);
    for (let changed = true; changed; ) {
      changed = false;
      for (const e of edges) if (reachable.has(e.parentId) && !reachable.has(e.childId)) reachable.add(e.childId), (changed = true);
    }
    const lineageSet = new Set(lineage);
    const keptUnions = unions.filter((u) => reachable.has(u.partner1Id) || reachable.has(u.partner2Id));
    for (const u of keptUnions) reachable.add(u.partner1Id), reachable.add(u.partner2Id);
    const depth = new Map(ids.map((r) => [r.id, Number(r.depth)]));
    return {
      rootId,
      nodes: [...reachable].map((id) => ({ ...nodes.get(id), depth: depth.get(id) ?? null, isLineage: lineageSet.has(id) })),
      edges: edges.filter((e) => reachable.has(e.parentId) && reachable.has(e.childId)),
      unions: keptUnions,
    };
  }

  async anniversaries(ctx: FamilyContext, withinDays: number, today = new Date()) {
    const from = { day: today.getDate(), month: today.getMonth() + 1, year: today.getFullYear() };
    const rows = await this.db.query<DbPerson>(
      `${PERSON_SELECT} WHERE p.family_id = $1 AND p.living_status = 'deceased'
         AND p.death_date->>'calendar' = 'lunar' AND p.death_date->>'month' IS NOT NULL AND p.death_date->>'day' IS NOT NULL`,
      [ctx.familyId],
    );
    return rows
      .filter((r) => present(r, this.view(r), ctx))
      .map((r) => {
        const d = r.death_date!;
        const next = nextAnniversary({ day: d.day!, month: d.month!, leap: d.isLeapMonth }, from);
        return {
          personId: r.id,
          name: primaryName(r),
          lunar: { day: d.day, month: d.month, isLeapMonth: d.isLeapMonth },
          date: toIso(next),
          inDays: daysBetween(from, next),
        };
      })
      .filter((a) => a.inDays <= withinDays)
      .sort((a, b) => a.inDays - b.inDays);
  }

  async history(ctx: FamilyContext) {
    return this.db.query(
      `SELECT c.id, c.summary, c.status, c.created_at AS "createdAt", u.full_name AS "author",
              (SELECT count(*)::int FROM change_items i WHERE i.change_set_id = c.id) AS "itemCount"
         FROM change_sets c JOIN users u ON u.id = c.author_id
        WHERE c.family_id = $1 ORDER BY c.created_at DESC LIMIT 200`,
      [ctx.familyId],
    );
  }

  // ---------- Ghi ----------

  async create(ctx: FamilyContext, input: PersonInput) {
    if (!input.isAnonymous && !input.names.length) throw new BadRequestException('Cần ít nhất một tên hoặc đánh dấu khuyết danh');
    if (input.livingStatus !== 'deceased' && input.deathDate) throw new BadRequestException('Người chưa mất không có ngày mất');
    // Người còn sống/chưa rõ do người khác nhập: chưa xác minh căn cứ (mục 4.2)
    const basis = input.livingStatus === 'deceased' ? 'not_required' : 'unverified';
    return this.db.tx(async (q) => {
      const [p] = await q.query<{ id: string }>(
        `INSERT INTO persons(family_id, gender, living_status, basis_status, generation_recorded, sibling_order,
                             sibling_order_note, is_anonymous, birth_date, death_date, biography, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [
          ctx.familyId, input.gender, input.livingStatus, basis, input.generationRecorded, input.siblingOrder,
          input.siblingOrderNote, input.isAnonymous, dateJson(input.birthDate), dateJson(input.deathDate),
          input.biography, ctx.userId,
        ],
      );
      const names = normalizeNames(input.names);
      for (const n of names) {
        await q.query(
          `INSERT INTO person_names(family_id, person_id, type, value_vi, value_han_nom, is_primary) VALUES ($1,$2,$3,$4,$5,$6)`,
          [ctx.familyId, p.id, n.type, n.valueVi, n.valueHanNom, n.isPrimary],
        );
      }
      const created = (await this.load(q, ctx.familyId, p.id))!;
      await recordChange(q, ctx, `Thêm ${primaryName(created)}`, [
        { table: 'persons', id: p.id, before: null, after: this.snapshot(created) },
      ]);
      return this.view(created);
    });
  }

  async update(ctx: FamilyContext, personId: string, patch: PersonPatch) {
    return this.db.tx(async (q) => {
      const before = await this.load(q, ctx.familyId, personId);
      if (!before || before.erased) throw new NotFoundException('Không tìm thấy người này');
      if (before.version !== patch.version)
        throw new ConflictException('Hồ sơ đã được người khác sửa. Hãy tải lại trước khi lưu.');
      const sets: string[] = [];
      const params: unknown[] = [];
      for (const [key, col] of Object.entries(PATCHABLE)) {
        if (!(key in patch)) continue;
        let value = (patch as any)[key];
        if (key === 'birthDate' || key === 'deathDate') value = dateJson(value);
        params.push(value);
        sets.push(`${col} = $${params.length}`);
      }
      const living = patch.livingStatus ?? before.living_status;
      const deathDate = 'deathDate' in patch ? patch.deathDate : before.death_date;
      if (living !== 'deceased' && deathDate) throw new BadRequestException('Người chưa mất không có ngày mất');
      if (patch.livingStatus) {
        // Đổi sang còn sống/chưa rõ thì phải xác minh căn cứ lại
        params.push(patch.livingStatus === 'deceased' ? 'not_required' : before.basis_status === 'not_required' ? 'unverified' : before.basis_status);
        sets.push(`basis_status = $${params.length}`);
      }
      if (!sets.length) return this.view(before);
      params.push(ctx.familyId, personId, patch.version);
      await q.query(
        `UPDATE persons SET ${sets.join(', ')}, version = version + 1, updated_at = now()
          WHERE family_id = $${params.length - 2} AND id = $${params.length - 1} AND version = $${params.length}`,
        params,
      );
      const after = (await this.load(q, ctx.familyId, personId))!;
      await recordChange(q, ctx, `Sửa ${primaryName(after)}`, [
        { table: 'persons', id: personId, before: this.snapshot(before), after: this.snapshot(after) },
      ]);
      return this.view(after);
    });
  }

  async verifyBasis(ctx: FamilyContext, personId: string) {
    return this.db.tx(async (q) => {
      const before = await this.load(q, ctx.familyId, personId);
      if (!before) throw new NotFoundException();
      if (before.basis_status !== 'unverified') return this.view(before);
      await q.query(`UPDATE persons SET basis_status = 'verified', version = version + 1 WHERE id = $1`, [personId]);
      const after = (await this.load(q, ctx.familyId, personId))!;
      await recordChange(q, ctx, `Xác minh căn cứ xử lý dữ liệu của ${primaryName(after)}`, [
        { table: 'persons', id: personId, before: this.snapshot(before), after: this.snapshot(after) },
      ]);
      return this.view(after);
    });
  }

  async addParentChild(ctx: FamilyContext, parentId: string, childId: string, type: string) {
    return this.db.tx(async (q) => {
      await lockFamilyGraph(q, ctx.familyId);
      const [parent, child] = await Promise.all([this.load(q, ctx.familyId, parentId), this.load(q, ctx.familyId, childId)]);
      if (!parent || !child || parent.erased || child.erased) throw new NotFoundException('Không tìm thấy người trong dòng họ');
      await assertNoAncestorCycle(q, ctx.familyId, parentId, childId);
      if (type === 'biological') {
        const [{ n }] = await q.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM parent_child WHERE child_id = $1 AND type = 'biological'`,
          [childId],
        );
        if (n >= 2) throw new BadRequestException('Một người chỉ có tối đa 2 cha mẹ đẻ');
      }
      const existing = await q.query(`SELECT 1 FROM parent_child WHERE parent_id = $1 AND child_id = $2`, [parentId, childId]);
      if (existing.length) throw new ConflictException('Quan hệ này đã tồn tại');
      const [row] = await q.query(
        `INSERT INTO parent_child(family_id, parent_id, child_id, type) VALUES ($1,$2,$3,$4)
         RETURNING id, family_id, parent_id, child_id, type`,
        [ctx.familyId, parentId, childId, type],
      );
      await recordChange(q, ctx, `${primaryName(parent)} là cha/mẹ của ${primaryName(child)}`, [
        { table: 'parent_child', id: row.id, before: null, after: row },
      ]);
      return { id: row.id, parentId, childId, type };
    });
  }

  async removeParentChild(ctx: FamilyContext, id: string) {
    return this.db.tx(async (q) => {
      await lockFamilyGraph(q, ctx.familyId);
      const [row] = await q.query(
        `DELETE FROM parent_child WHERE family_id = $1 AND id = $2 RETURNING id, family_id, parent_id, child_id, type`,
        [ctx.familyId, id],
      );
      if (!row) throw new NotFoundException();
      await recordChange(q, ctx, 'Xóa quan hệ cha mẹ - con', [{ table: 'parent_child', id, before: row, after: null }]);
    });
  }

  async addUnion(ctx: FamilyContext, input: { partner1Id: string; partner2Id: string; unionOrder: number | null; unionLabel: string | null; endReason: string | null }) {
    if (input.partner1Id === input.partner2Id) throw new BadRequestException('Không thể kết hôn với chính mình');
    return this.db.tx(async (q) => {
      await lockFamilyGraph(q, ctx.familyId);
      const [a, b] = await Promise.all([this.load(q, ctx.familyId, input.partner1Id), this.load(q, ctx.familyId, input.partner2Id)]);
      if (!a || !b || a.erased || b.erased) throw new NotFoundException('Không tìm thấy người trong dòng họ');
      const dup = await q.query(
        `SELECT 1 FROM unions WHERE (partner1_id = $1 AND partner2_id = $2) OR (partner1_id = $2 AND partner2_id = $1)`,
        [input.partner1Id, input.partner2Id],
      );
      if (dup.length) throw new ConflictException('Quan hệ hôn phối này đã tồn tại');
      const [row] = await q.query(
        `INSERT INTO unions(family_id, partner1_id, partner2_id, union_order, union_label, end_reason)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, family_id, partner1_id, partner2_id, union_order, union_label, start_date, end_date, end_reason`,
        [ctx.familyId, input.partner1Id, input.partner2Id, input.unionOrder, input.unionLabel, input.endReason],
      );
      await recordChange(q, ctx, `Hôn phối ${primaryName(a)} - ${primaryName(b)}`, [{ table: 'unions', id: row.id, before: null, after: row }]);
      return { id: row.id, ...input };
    });
  }

  async removeUnion(ctx: FamilyContext, id: string) {
    return this.db.tx(async (q) => {
      await lockFamilyGraph(q, ctx.familyId);
      const [row] = await q.query(
        `DELETE FROM unions WHERE family_id = $1 AND id = $2
         RETURNING id, family_id, partner1_id, partner2_id, union_order, union_label, start_date, end_date, end_reason`,
        [ctx.familyId, id],
      );
      if (!row) throw new NotFoundException();
      await recordChange(q, ctx, 'Xóa quan hệ hôn phối', [{ table: 'unions', id, before: row, after: null }]);
    });
  }

  /**
   * Hoàn tác một giao dịch (mục 2.1(9)): kiểm tra lại ràng buộc, xung đột với thay đổi sau đó,
   * và không bao giờ làm sống lại dữ liệu đã xóa theo yêu cầu (erasure_registry).
   */
  async revert(ctx: FamilyContext, changeSetId: string) {
    return this.db.tx(async (q) => {
      await lockFamilyGraph(q, ctx.familyId);
      const [cs] = await q.query<{ status: string; summary: string }>(
        `SELECT status, summary FROM change_sets WHERE family_id = $1 AND id = $2`,
        [ctx.familyId, changeSetId],
      );
      if (!cs) throw new NotFoundException();
      if (cs.status === 'reverted') throw new ConflictException('Thay đổi này đã được hoàn tác');
      const items = await q.query<{ target_table: string; target_id: string; before: any; after: any }>(
        `SELECT target_table, target_id, before, after FROM change_items WHERE change_set_id = $1`,
        [changeSetId],
      );
      const undo: ChangeItem[] = [];
      for (const it of items.reverse()) {
        const involved = [it.target_id, it.before?.parent_id, it.before?.child_id, it.before?.partner1_id, it.before?.partner2_id, it.before?.person_id].filter(Boolean);
        const erased = await q.query(`SELECT 1 FROM erasure_registry WHERE target_id = ANY($1::uuid[])`, [involved]);
        if (erased.length) throw new GoneException('Không thể hoàn tác: có dữ liệu đã bị xóa theo yêu cầu của chủ thể dữ liệu');
        undo.push(await revertItem(q, ctx, it));
      }
      await q.query(`UPDATE change_sets SET status = 'reverted' WHERE id = $1`, [changeSetId]);
      await recordChange(q, ctx, `Hoàn tác: ${cs.summary}`, undo);
      return { reverted: changeSetId };
    });
  }

  // ---------- Tiện ích ----------

  private async load(q: Queryable, familyId: string, personId: string): Promise<DbPerson | undefined> {
    const [row] = await q.query<DbPerson>(`${PERSON_SELECT} WHERE p.family_id = $1 AND p.id = $2`, [familyId, personId]);
    return row;
  }

  private async summaries(ctx: FamilyContext, ids: string[]) {
    const map = new Map<string, any>();
    if (!ids.length) return map;
    const rows = await this.db.query<DbPerson>(`${PERSON_SELECT} WHERE p.family_id = $1 AND p.id = ANY($2::uuid[])`, [ctx.familyId, ids]);
    for (const r of rows) {
      const v = present(r, this.view(r), ctx);
      if (v) map.set(r.id, v.masked ? v : { id: v.id, displayName: v.displayName, gender: v.gender, livingStatus: v.livingStatus, years: v.years });
    }
    return map;
  }

  private view(r: DbPerson) {
    return {
      id: r.id,
      displayName: primaryName(r),
      gender: r.gender,
      livingStatus: r.living_status,
      basisStatus: r.basis_status,
      generationRecorded: r.generation_recorded,
      siblingOrder: r.sibling_order,
      siblingOrderNote: r.sibling_order_note,
      isAnonymous: r.is_anonymous,
      birthDate: r.birth_date,
      deathDate: r.death_date,
      years: yearsLabel(r),
      biography: r.biography,
      names: r.names,
      version: r.version,
    };
  }

  private snapshot(r: DbPerson) {
    const { names, erased, ...cols } = r as any;
    return { ...cols, names };
  }
}

// ---------- Đồ thị ----------

/** Tuần tự hóa mọi thao tác sửa đồ thị của một dòng họ (mục 5.1). */
export async function lockFamilyGraph(q: Queryable, familyId: string) {
  await q.query(`SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))`, [familyId]);
}

/** Thêm cạnh parent -> child tạo chu trình khi parent đã là hậu duệ của child. */
async function assertNoAncestorCycle(q: Queryable, familyId: string, parentId: string, childId: string) {
  const [hit] = await q.query(
    `WITH RECURSIVE d(id) AS (
       SELECT child_id FROM parent_child WHERE family_id = $1 AND parent_id = $2
       UNION
       SELECT pc.child_id FROM parent_child pc JOIN d ON pc.parent_id = d.id WHERE pc.family_id = $1
     ) SELECT 1 FROM d WHERE id = $3 LIMIT 1`,
    [familyId, childId, parentId],
  );
  if (hit) throw new BadRequestException('Không thể thêm: người này sẽ trở thành tổ tiên của chính mình');
}

// ---------- Lịch sử thay đổi ----------

export interface ChangeItem {
  table: string;
  id: string;
  before: any;
  after: any;
}

export async function recordChange(q: Queryable, ctx: FamilyContext, summary: string, items: ChangeItem[]) {
  const [cs] = await q.query<{ id: string }>(
    `INSERT INTO change_sets(family_id, author_id, summary) VALUES ($1, $2, $3) RETURNING id`,
    [ctx.familyId, ctx.userId, summary],
  );
  for (const it of items) {
    await q.query(
      `INSERT INTO change_items(change_set_id, target_table, target_id, before, after) VALUES ($1,$2,$3,$4,$5)`,
      [cs.id, it.table, it.id, json(it.before), json(it.after)],
    );
  }
  return cs.id;
}

async function revertItem(q: Queryable, ctx: FamilyContext, it: { target_table: string; target_id: string; before: any; after: any }): Promise<ChangeItem> {
  const conflict = () => new ConflictException('Không thể hoàn tác: dữ liệu đã thay đổi sau giao dịch này');
  switch (it.target_table) {
    case 'parent_child': {
      if (it.after && !it.before) {
        const [row] = await q.query(`DELETE FROM parent_child WHERE family_id = $1 AND id = $2 RETURNING *`, [ctx.familyId, it.target_id]);
        if (!row) throw conflict();
        return { table: 'parent_child', id: it.target_id, before: it.after, after: null };
      }
      const b = it.before;
      await assertNoAncestorCycle(q, ctx.familyId, b.parent_id, b.child_id);
      const [row] = await q.query(
        `INSERT INTO parent_child(id, family_id, parent_id, child_id, type) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT DO NOTHING RETURNING id, family_id, parent_id, child_id, type`,
        [b.id, ctx.familyId, b.parent_id, b.child_id, b.type],
      );
      if (!row) throw conflict();
      return { table: 'parent_child', id: b.id, before: null, after: row };
    }
    case 'unions': {
      if (it.after && !it.before) {
        const [row] = await q.query(`DELETE FROM unions WHERE family_id = $1 AND id = $2 RETURNING *`, [ctx.familyId, it.target_id]);
        if (!row) throw conflict();
        return { table: 'unions', id: it.target_id, before: it.after, after: null };
      }
      const b = it.before;
      const [row] = await q.query(
        `INSERT INTO unions(id, family_id, partner1_id, partner2_id, union_order, union_label, start_date, end_date, end_reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING RETURNING *`,
        [b.id, ctx.familyId, b.partner1_id, b.partner2_id, b.union_order, b.union_label, json(b.start_date), json(b.end_date), b.end_reason],
      );
      if (!row) throw conflict();
      return { table: 'unions', id: b.id, before: null, after: row };
    }
    case 'places': {
      if (it.after && !it.before) {
        const [row] = await q.query(`DELETE FROM places WHERE family_id = $1 AND id = $2 RETURNING *`, [ctx.familyId, it.target_id]);
        if (!row) throw conflict();
        return { table: 'places', id: it.target_id, before: it.after, after: null };
      }
      const b = it.before;
      const [row] = await q.query(
        `INSERT INTO places(id, family_id, person_id, kind, name, note, lat, lng, precision, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING RETURNING *`,
        [b.id, ctx.familyId, b.person_id, b.kind, b.name, b.note, b.lat, b.lng, b.precision, b.created_by],
      );
      if (!row) throw conflict();
      return { table: 'places', id: b.id, before: null, after: row };
    }
    case 'persons': {
      if (!it.before) throw new BadRequestException('Chưa hỗ trợ hoàn tác việc thêm người; hãy xóa người đó');
      const [cur] = await q.query(`SELECT version FROM persons WHERE family_id = $1 AND id = $2`, [ctx.familyId, it.target_id]);
      if (!cur || cur.version !== it.after.version) throw conflict();
      const b = it.before;
      const [row] = await q.query(
        `UPDATE persons SET gender=$3, living_status=$4, basis_status=$5, generation_recorded=$6, sibling_order=$7,
                sibling_order_note=$8, is_anonymous=$9, birth_date=$10, death_date=$11, biography=$12,
                version = version + 1, updated_at = now()
          WHERE family_id = $1 AND id = $2 RETURNING *`,
        [ctx.familyId, it.target_id, b.gender, b.living_status, b.basis_status, b.generation_recorded, b.sibling_order,
         b.sibling_order_note, b.is_anonymous, json(b.birth_date), json(b.death_date), b.biography],
      );
      return { table: 'persons', id: it.target_id, before: it.after, after: row };
    }
    default:
      throw new BadRequestException(`Không hỗ trợ hoàn tác ${it.target_table}`);
  }
}

// ---------- Định dạng ----------

function normalizeNames(names: NameInput[]): NameInput[] {
  if (!names.length) return names;
  const primaryIdx = Math.max(0, names.findIndex((n) => n.isPrimary));
  return names.map((n, i) => ({ ...n, isPrimary: i === primaryIdx }));
}

function primaryName(r: { names: { valueVi: string; isPrimary: boolean }[]; is_anonymous?: boolean }) {
  return r.names.find((n) => n.isPrimary)?.valueVi ?? r.names[0]?.valueVi ?? 'Khuyết danh';
}

function yearsLabel(r: DbPerson): string | null {
  const y = (d: StoredDate | null) => (d?.solarDerived ? d.solarDerived.from.slice(0, 4) : d?.year != null ? String(d.year) : null);
  const b = y(r.birth_date);
  const d = y(r.death_date);
  if (!b && !d) return null;
  return `${b ?? '?'} – ${r.living_status === 'deceased' ? d ?? '?' : ''}`.trim();
}

const dateJson = (d: FlexibleDateInput | null | undefined) => (d ? JSON.stringify(toStoredDate(d)) : null);
const json = (v: unknown) => (v == null ? null : JSON.stringify(v));

/** Bỏ dấu tiếng Việt để tìm kiếm không dấu. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}
