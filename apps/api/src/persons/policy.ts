import type { FamilyContext } from '../families/access';

/**
 * Lớp policy duy nhất quyết định người xem được thấy gì (mục 5.5).
 * Thứ tự ưu tiên: danh sách xóa -> trạng thái căn cứ -> riêng tư -> vai trò.
 */
export interface PersonRow {
  id: string;
  living_status: 'alive' | 'deceased' | 'unknown';
  basis_status: 'verified' | 'unverified' | 'not_required';
  created_by: string;
  erased?: boolean;
}

export type Visibility = 'full' | 'masked' | 'hidden';

const MEMBER_ROLES = ['owner', 'co_admin', 'editor', 'branch_editor', 'member'];

export function visibilityOf(p: PersonRow, ctx: FamilyContext): Visibility {
  if (p.erased) return 'hidden';
  if (p.basis_status === 'unverified') {
    // Chỉ người nhập và ban quản lý thấy; không xuất hiện ở cây/tìm kiếm của người khác
    return ctx.role === 'owner' || ctx.role === 'co_admin' || p.created_by === ctx.userId ? 'full' : 'hidden';
  }
  if (p.living_status === 'deceased') return 'full';
  // Còn sống hoặc chưa rõ (đã xác minh căn cứ): chỉ thành viên trong họ, khách bị che
  return MEMBER_ROLES.includes(ctx.role) ? 'full' : 'masked';
}

export const MASKED_NAME = 'Người được bảo vệ';

/** Áp policy cho một bản ghi người đã được API định dạng. */
export function present<T extends { id: string }>(
  row: PersonRow,
  view: T,
  ctx: FamilyContext,
): (T & { masked: false }) | { id: string; masked: true; displayName: string } | null {
  const v = visibilityOf(row, ctx);
  if (v === 'hidden') return null;
  if (v === 'masked') return { id: row.id, masked: true, displayName: MASKED_NAME };
  return { ...view, masked: false };
}
