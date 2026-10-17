import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, AuthUser, CurrentUser } from '../auth/auth';
import { ZodPipe } from '../common/zod';
import { DB, Db, Queryable } from '../db/db';
import { AccessService, CAN, FamilyContext } from '../families/access';
import { visibilityOf } from '../persons/policy';
import { recordChange } from '../persons/persons.service';

export const PLACE_KINDS = ['burial', 'reburial', 'cenotaph', 'birth', 'residence', 'ancestral_hall', 'origin'] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

const FAMILY_KINDS: PlaceKind[] = ['ancestral_hall', 'origin'];
/** Người còn sống/chưa rõ chỉ được gắn nơi sinh, nơi ở - không có mộ phần. */
const LIVING_KINDS: PlaceKind[] = ['birth', 'residence'];

/** Làm tròn ~10 km: đủ biết tỉnh/huyện, không lộ địa chỉ nhà (mục 5.5 kế hoạch). */
export const coarsen = (v: number) => Math.round(v * 10) / 10;

const placeSchema = z.object({
  personId: z.uuid().nullable().default(null),
  kind: z.enum(PLACE_KINDS),
  name: z.string().trim().min(1).max(200),
  note: z.string().trim().max(2000).nullable().default(null),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
type PlaceInput = z.infer<typeof placeSchema>;

interface PlaceRow {
  id: string;
  person_id: string | null;
  kind: PlaceKind;
  name: string;
  note: string | null;
  lat: number;
  lng: number;
  precision: 'exact' | 'coarse';
  // từ persons (nếu có)
  living_status?: 'alive' | 'deceased' | 'unknown';
  basis_status?: 'verified' | 'unverified' | 'not_required';
  person_created_by?: string;
  generation_recorded?: number | null;
  person_name?: string | null;
  erased?: boolean;
}

const PLACE_SELECT = `
  SELECT pl.*, p.living_status, p.basis_status, p.created_by AS person_created_by, p.generation_recorded,
         (SELECT n.value_vi FROM person_names n WHERE n.person_id = p.id ORDER BY n.is_primary DESC LIMIT 1) AS person_name,
         EXISTS (SELECT 1 FROM erasure_registry e WHERE e.target_type = 'person' AND e.target_id = p.id) AS erased
    FROM places pl LEFT JOIN persons p ON p.family_id = pl.family_id AND p.id = pl.person_id`;

@Injectable()
export class PlacesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(ctx: FamilyContext, filter: { personId?: string; generation?: number }) {
    const params: unknown[] = [ctx.familyId];
    let where = 'pl.family_id = $1';
    if (filter.personId) {
      params.push(filter.personId);
      where += ` AND pl.person_id = $${params.length}`;
    }
    if (filter.generation) {
      params.push(filter.generation);
      where += ` AND p.generation_recorded = $${params.length}`;
    }
    const rows = await this.db.query<PlaceRow>(`${PLACE_SELECT} WHERE ${where} ORDER BY pl.created_at`, params);
    return rows.map((r) => this.present(r, ctx)).filter(Boolean);
  }

  async create(ctx: FamilyContext, input: PlaceInput) {
    return this.db.tx(async (q) => {
      const precision = await this.checkTarget(q, ctx, input);
      const lat = precision === 'coarse' ? coarsen(input.lat) : input.lat;
      const lng = precision === 'coarse' ? coarsen(input.lng) : input.lng;
      const [row] = await q.query(
        `INSERT INTO places(family_id, person_id, kind, name, note, lat, lng, precision, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [ctx.familyId, input.personId, input.kind, input.name, input.note, lat, lng, precision, ctx.userId],
      );
      await recordChange(q, ctx, `Thêm địa điểm: ${input.name}`, [{ table: 'places', id: row.id, before: null, after: row }]);
      const [full] = await q.query<PlaceRow>(`${PLACE_SELECT} WHERE pl.id = $1`, [row.id]);
      return this.present(full, ctx);
    });
  }

  async remove(ctx: FamilyContext, id: string) {
    return this.db.tx(async (q) => {
      const [row] = await q.query(`DELETE FROM places WHERE family_id = $1 AND id = $2 RETURNING *`, [ctx.familyId, id]);
      if (!row) throw new NotFoundException();
      await recordChange(q, ctx, `Xóa địa điểm: ${row.name}`, [{ table: 'places', id, before: row, after: null }]);
    });
  }

  /** Kiểm tra người thuộc dòng họ, loại địa điểm hợp lệ; trả về độ chính xác được phép lưu. */
  private async checkTarget(q: Queryable, ctx: FamilyContext, input: PlaceInput): Promise<'exact' | 'coarse'> {
    if (FAMILY_KINDS.includes(input.kind)) {
      if (input.personId) throw new BadRequestException('Nhà thờ họ/nguyên quán là địa điểm chung, không gắn với một người');
      return 'exact';
    }
    if (!input.personId) throw new BadRequestException('Cần chọn người cho loại địa điểm này');
    const [p] = await q.query<{ living_status: string }>(
      `SELECT living_status FROM persons p WHERE family_id = $1 AND id = $2
         AND NOT EXISTS (SELECT 1 FROM erasure_registry e WHERE e.target_type = 'person' AND e.target_id = p.id)`,
      [ctx.familyId, input.personId],
    );
    if (!p) throw new NotFoundException('Không tìm thấy người trong dòng họ');
    if (p.living_status === 'deceased') return 'exact';
    if (!LIVING_KINDS.includes(input.kind))
      throw new BadRequestException('Người còn sống hoặc chưa rõ chỉ được gắn nơi sinh hoặc nơi ở (cấp tỉnh/huyện)');
    return 'coarse';
  }

  /** Áp policy riêng tư cho từng điểm; người còn sống luôn bị làm tròn tọa độ, không có ghi chú. */
  private present(r: PlaceRow, ctx: FamilyContext) {
    const base = { id: r.id, kind: r.kind, name: r.name, note: r.note, lat: r.lat, lng: r.lng, precision: r.precision, person: null as null | object };
    if (!r.person_id) return base;
    const v = visibilityOf(
      { id: r.person_id, living_status: r.living_status!, basis_status: r.basis_status!, created_by: r.person_created_by!, erased: r.erased },
      ctx,
    );
    // Bản che vẫn có thể lộ vị trí của người được bảo vệ -> ẩn hẳn
    if (v !== 'full') return null;
    const person = { id: r.person_id, displayName: r.person_name ?? 'Khuyết danh', generationRecorded: r.generation_recorded ?? null, livingStatus: r.living_status };
    if (r.living_status === 'deceased') return { ...base, person };
    return { ...base, note: null, lat: coarsen(r.lat), lng: coarsen(r.lng), precision: 'coarse' as const, person };
  }
}

@Controller('families/:familyId/places')
@UseGuards(AuthGuard)
export class PlacesController {
  constructor(
    private readonly access: AccessService,
    private readonly places: PlacesService,
  ) {}

  @Get()
  async list(
    @CurrentUser() u: AuthUser,
    @Param('familyId', ParseUUIDPipe) fid: string,
    @Query('personId') personId?: string,
    @Query('generation') generation?: string,
  ) {
    if (personId && !z.uuid().safeParse(personId).success) throw new BadRequestException('personId không hợp lệ');
    const g = generation ? Number(generation) : undefined;
    return this.places.list(await this.access.context(fid, u.id), { personId, generation: Number.isInteger(g) ? g : undefined });
  }

  @Post()
  async create(@CurrentUser() u: AuthUser, @Param('familyId', ParseUUIDPipe) fid: string, @Body(new ZodPipe(placeSchema)) body: PlaceInput) {
    return this.places.create(await this.access.require(fid, u.id, CAN.editPersons), body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('familyId', ParseUUIDPipe) fid: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.places.remove(await this.access.require(fid, u.id, CAN.editPersons), id);
  }
}
