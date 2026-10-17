import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DB, Db, Queryable } from '../db/db';

export const ROLES = ['owner', 'co_admin', 'editor', 'branch_editor', 'member', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

/** Khả năng thao tác theo vai trò (mục 6). Dữ liệu được thấy do policy.ts quyết định. */
export const CAN = {
  editPersons: ['owner', 'co_admin', 'editor'] as Role[],
  manageMembers: ['owner', 'co_admin'] as Role[],
  verifyBasis: ['owner', 'co_admin'] as Role[],
  revert: ['owner', 'co_admin', 'editor'] as Role[],
};

export interface FamilyContext {
  familyId: string;
  userId: string;
  role: Role;
}

@Injectable()
export class AccessService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Ngữ cảnh tenant luôn lấy từ quyền đã xác minh trong CSDL, không tin tham số client (mục 5.6).
   * Không phải thành viên -> 404 để không lộ sự tồn tại của dòng họ.
   */
  async context(familyId: string, userId: string, q: Queryable = this.db): Promise<FamilyContext> {
    const [row] = await q.query<{ role: Role }>(
      'SELECT role FROM family_roles WHERE family_id = $1 AND user_id = $2',
      [familyId, userId],
    );
    if (!row) throw new NotFoundException('Không tìm thấy dòng họ');
    return { familyId, userId, role: row.role };
  }

  async require(familyId: string, userId: string, allowed: Role[], q?: Queryable): Promise<FamilyContext> {
    const ctx = await this.context(familyId, userId, q);
    if (!allowed.includes(ctx.role)) throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    return ctx;
  }
}
