import { Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, AuthUser, CurrentUser } from '../auth/auth';
import { ZodPipe } from '../common/zod';
import { DB, Db } from '../db/db';
import { AccessService, CAN, ROLES } from './access';

const createFamilySchema = z.object({
  name: z.string().trim().min(1).max(200),
  surname: z.string().trim().min(1).max(50),
  originPlace: z.string().trim().max(300).nullable().default(null),
  description: z.string().max(5000).nullable().default(null),
});

const addMemberSchema = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  role: z.enum(ROLES).exclude(['owner']),
});

@Controller('families')
@UseGuards(AuthGuard)
export class FamiliesController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly access: AccessService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.db.query(
      `SELECT f.id, f.name, f.surname, f.origin_place AS "originPlace", r.role,
              (SELECT count(*)::int FROM persons p WHERE p.family_id = f.id) AS "personCount"
         FROM families f JOIN family_roles r ON r.family_id = f.id AND r.user_id = $1
        ORDER BY f.created_at DESC`,
      [user.id],
    );
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createFamilySchema)) body: z.infer<typeof createFamilySchema>) {
    return this.db.tx(async (q) => {
      const [family] = await q.query(
        `INSERT INTO families(name, surname, origin_place, description, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, surname, origin_place AS "originPlace", description`,
        [body.name, body.surname, body.originPlace, body.description, user.id],
      );
      await q.query(`INSERT INTO family_roles(family_id, user_id, role, granted_by) VALUES ($1, $2, 'owner', $2)`, [
        family.id,
        user.id,
      ]);
      return { ...family, role: 'owner' };
    });
  }

  @Get(':familyId')
  async get(@CurrentUser() user: AuthUser, @Param('familyId', ParseUUIDPipe) familyId: string) {
    const ctx = await this.access.context(familyId, user.id);
    const [family] = await this.db.query(
      `SELECT id, name, surname, origin_place AS "originPlace", description, founder_person_id AS "founderPersonId"
         FROM families WHERE id = $1`,
      [familyId],
    );
    return { ...family, role: ctx.role };
  }

  @Get(':familyId/members')
  async members(@CurrentUser() user: AuthUser, @Param('familyId', ParseUUIDPipe) familyId: string) {
    await this.access.context(familyId, user.id);
    return this.db.query(
      `SELECT u.id, u.email, u.full_name AS "fullName", r.role
         FROM family_roles r JOIN users u ON u.id = r.user_id
        WHERE r.family_id = $1 ORDER BY r.created_at`,
      [familyId],
    );
  }

  @Post(':familyId/members')
  async addMember(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Body(new ZodPipe(addMemberSchema)) body: z.infer<typeof addMemberSchema>,
  ) {
    const ctx = await this.access.require(familyId, user.id, CAN.manageMembers);
    if (ctx.role === 'co_admin' && body.role === 'co_admin')
      throw new ForbiddenException('Chỉ chủ sở hữu được cấp quyền đồng quản trị');
    const [target] = await this.db.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [body.email]);
    if (!target) throw new NotFoundException('Chưa có tài khoản với email này');
    const [existing] = await this.db.query<{ role: string }>(
      'SELECT role FROM family_roles WHERE family_id = $1 AND user_id = $2',
      [familyId, target.id],
    );
    if (existing?.role === 'owner') throw new ForbiddenException('Không thể đổi vai trò của chủ sở hữu');
    await this.db.query(
      `INSERT INTO family_roles(family_id, user_id, role, granted_by) VALUES ($1, $2, $3, $4)
       ON CONFLICT (family_id, user_id) DO UPDATE SET role = EXCLUDED.role, granted_by = EXCLUDED.granted_by`,
      [familyId, target.id, body.role, user.id],
    );
    return { userId: target.id, role: body.role };
  }
}
