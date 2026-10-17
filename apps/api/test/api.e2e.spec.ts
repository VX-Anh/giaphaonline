import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createDb, Db, migrate } from '../src/db/db';
import { createApp } from '../src/main';

let app: INestApplication;
let db: Db;
const http = () => request(app.getHttpServer());

async function register(email: string) {
  const res = await http().post('/api/auth/register').send({ email, password: 'matkhau123', fullName: email.split('@')[0] });
  expect(res.status).toBe(201);
  return res.body.accessToken as string;
}

const as = (token: string) => ({
  get: (url: string) => http().get(url).set('Authorization', `Bearer ${token}`),
  post: (url: string, body?: object) => http().post(url).set('Authorization', `Bearer ${token}`).send(body ?? {}),
  patch: (url: string, body: object) => http().patch(url).set('Authorization', `Bearer ${token}`).send(body),
  del: (url: string) => http().delete(url).set('Authorization', `Bearer ${token}`),
});

async function person(token: string, fid: string, name: string, extra: object = {}) {
  const res = await as(token).post(`/api/families/${fid}/persons`, {
    livingStatus: 'deceased',
    gender: 'male',
    names: [{ valueVi: name, isPrimary: true }],
    ...extra,
  });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

beforeAll(async () => {
  db = await createDb('memory://');
  await migrate(db);
  app = await createApp(db, 'test-secret');
  await app.init();
});

afterAll(async () => {
  await app.close();
  await db.close();
});

describe('auth', () => {
  it('registers, logs in and rejects bad credentials', async () => {
    await register('a@x.vn');
    expect((await http().post('/api/auth/login').send({ email: 'A@x.vn', password: 'matkhau123' })).status).toBe(201);
    expect((await http().post('/api/auth/login').send({ email: 'a@x.vn', password: 'sai' })).status).toBe(401);
    expect((await http().post('/api/auth/register').send({ email: 'a@x.vn', password: 'matkhau123', fullName: 'A' })).status).toBe(409);
    expect((await http().get('/api/families')).status).toBe(401);
  });
});

describe('family genealogy', () => {
  let owner: string, other: string, viewer: string, fid: string;
  let toTien: string, con: string, chau: string;

  beforeAll(async () => {
    owner = await register('owner@x.vn');
    other = await register('other@x.vn');
    viewer = await register('viewer@x.vn');
    const f = await as(owner).post('/api/families', { name: 'Họ Nguyễn Văn', surname: 'Nguyễn' });
    expect(f.status).toBe(201);
    fid = f.body.id;
    await as(owner).post(`/api/families/${fid}/members`, { email: 'viewer@x.vn', role: 'viewer' }).expect(201);

    toTien = await person(owner, fid, 'Nguyễn Văn Tổ', {
      generationRecorded: 1,
      deathDate: { calendar: 'lunar', year: 1890, month: 3, day: 10 },
    });
    con = await person(owner, fid, 'Nguyễn Văn Con', { generationRecorded: 2 });
    chau = await person(owner, fid, 'Nguyễn Văn Cháu', { generationRecorded: 3 });
    await as(owner).post(`/api/families/${fid}/parent-child`, { parentId: toTien, childId: con }).expect(201);
    await as(owner).post(`/api/families/${fid}/parent-child`, { parentId: con, childId: chau }).expect(201);
  });

  it('isolates tenants: non-members get 404 for the family and its people', async () => {
    await as(other).get(`/api/families/${fid}`).expect(404);
    await as(other).get(`/api/families/${fid}/persons/${toTien}`).expect(404);
    const f2 = await as(other).post('/api/families', { name: 'Họ Trần', surname: 'Trần' });
    // Không thể tham chiếu người của họ khác, kể cả khi biết id
    const res = await as(other).post(`/api/families/${f2.body.id}/parent-child`, { parentId: toTien, childId: con });
    expect(res.status).toBe(404);
  });

  it('rejects ancestor cycles', async () => {
    const res = await as(owner).post(`/api/families/${fid}/parent-child`, { parentId: chau, childId: toTien });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/tổ tiên của chính mình/);
  });

  it('allows only one of two concurrent edges that would form a cycle', async () => {
    const a = await person(owner, fid, 'A');
    const b = await person(owner, fid, 'B');
    const results = await Promise.all([
      as(owner).post(`/api/families/${fid}/parent-child`, { parentId: a, childId: b }),
      as(owner).post(`/api/families/${fid}/parent-child`, { parentId: b, childId: a }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
  });

  it('limits biological parents to two', async () => {
    const kid = await person(owner, fid, 'Kid');
    for (const n of ['P1', 'P2']) {
      await as(owner).post(`/api/families/${fid}/parent-child`, { parentId: await person(owner, fid, n), childId: kid }).expect(201);
    }
    const p3 = await person(owner, fid, 'P3');
    await as(owner).post(`/api/families/${fid}/parent-child`, { parentId: p3, childId: kid }).expect(400);
    await as(owner).post(`/api/families/${fid}/parent-child`, { parentId: p3, childId: kid, type: 'adoptive' }).expect(201);
  });

  it('builds a descendant tree with spouses', async () => {
    const vo = await person(owner, fid, 'Lê Thị Vợ', { gender: 'female' });
    await as(owner).post(`/api/families/${fid}/unions`, { partner1Id: toTien, partner2Id: vo, unionLabel: 'chính thất' }).expect(201);
    const res = await as(owner).get(`/api/families/${fid}/tree/${toTien}`).expect(200);
    const names = res.body.nodes.map((n: any) => n.displayName).sort();
    expect(names).toEqual(['Lê Thị Vợ', 'Nguyễn Văn Con', 'Nguyễn Văn Cháu', 'Nguyễn Văn Tổ'].sort());
    expect(res.body.edges).toHaveLength(2);
    expect(res.body.unions).toHaveLength(1);
    expect(res.body.nodes.find((n: any) => n.displayName === 'Lê Thị Vợ').isLineage).toBe(false);
  });

  it('stores lunar dates with a derived solar value and rejects invalid ones', async () => {
    const res = await as(owner).get(`/api/families/${fid}/persons/${toTien}`).expect(200);
    expect(res.body.deathDate.solarDerived.from).toMatch(/^1890-04-/);
    const bad = await as(owner).post(`/api/families/${fid}/persons`, {
      livingStatus: 'deceased',
      names: [{ valueVi: 'X' }],
      deathDate: { calendar: 'lunar', year: 2024, month: 3, isLeapMonth: true },
    });
    expect(bad.status).toBe(400);
  });

  it('lists upcoming lunar anniversaries', async () => {
    const res = await as(owner).get(`/api/families/${fid}/anniversaries?days=400`).expect(200);
    expect(res.body.find((a: any) => a.personId === toTien)).toMatchObject({ lunar: { day: 10, month: 3 } });
  });

  it('applies privacy policy: unverified living people hidden, verified living masked for viewers', async () => {
    const living = await person(owner, fid, 'Nguyễn Văn Sống', { livingStatus: 'alive' });
    await as(owner).post(`/api/families/${fid}/parent-child`, { parentId: chau, childId: living }).expect(201);

    // Chưa xác minh căn cứ: viewer không thấy, kể cả qua cây
    await as(viewer).get(`/api/families/${fid}/persons/${living}`).expect(404);
    let tree = await as(viewer).get(`/api/families/${fid}/tree/${toTien}`).expect(200);
    expect(tree.body.nodes.some((n: any) => n.id === living)).toBe(false);

    await as(owner).post(`/api/families/${fid}/persons/${living}/verify-basis`).expect(201);

    // Đã xác minh nhưng còn sống: viewer chỉ thấy bản che
    const masked = await as(viewer).get(`/api/families/${fid}/persons/${living}`).expect(200);
    expect(masked.body).toEqual({ id: living, masked: true, displayName: 'Người được bảo vệ' });
    tree = await as(viewer).get(`/api/families/${fid}/tree/${toTien}`).expect(200);
    expect(tree.body.nodes.find((n: any) => n.id === living).masked).toBe(true);
    // Không tìm ra người bị che bằng tên
    const search = await as(viewer).get(`/api/families/${fid}/persons?q=song`).expect(200);
    expect(search.body).toHaveLength(0);
    const ownerSearch = await as(owner).get(`/api/families/${fid}/persons?q=song`).expect(200);
    expect(ownerSearch.body).toHaveLength(1);
  });

  it('forbids viewers from editing', async () => {
    await as(viewer).post(`/api/families/${fid}/persons`, { names: [{ valueVi: 'X' }] }).expect(403);
  });

  it('uses optimistic locking on person updates', async () => {
    const first = await as(owner).patch(`/api/families/${fid}/persons/${con}`, { version: 1, biography: 'Sửa lần 1' }).expect(200);
    expect(first.body.version).toBe(2);
    await as(owner).patch(`/api/families/${fid}/persons/${con}`, { version: 1, biography: 'Ghi đè' }).expect(409);
  });

  it('reverts a change set and refuses to revert twice', async () => {
    const history = await as(owner).get(`/api/families/${fid}/history`).expect(200);
    const edit = history.body.find((h: any) => h.summary === 'Sửa Nguyễn Văn Con');
    await as(owner).post(`/api/families/${fid}/history/${edit.id}/revert`).expect(201);
    const p = await as(owner).get(`/api/families/${fid}/persons/${con}`).expect(200);
    expect(p.body.biography).toBeNull();
    await as(owner).post(`/api/families/${fid}/history/${edit.id}/revert`).expect(409);
  });

  it('never resurrects erased data on revert', async () => {
    const x = await person(owner, fid, 'Bị xóa');
    const link = await as(owner).post(`/api/families/${fid}/parent-child`, { parentId: chau, childId: x }).expect(201);
    await as(owner).del(`/api/families/${fid}/parent-child/${link.body.id}`).expect(204);
    await db.query(`INSERT INTO erasure_registry(family_id, target_type, target_id) VALUES ($1, 'person', $2)`, [fid, x]);
    const history = await as(owner).get(`/api/families/${fid}/history`).expect(200);
    const removal = history.body.find((h: any) => h.summary === 'Xóa quan hệ cha mẹ - con');
    await as(owner).post(`/api/families/${fid}/history/${removal.id}/revert`).expect(410);
  });
});

describe('places (map)', () => {
  let owner: string, viewer: string, member: string, outsider: string, fid: string, dead: string, living: string;

  beforeAll(async () => {
    owner = await register('map-owner@x.vn');
    viewer = await register('map-viewer@x.vn');
    member = await register('map-member@x.vn');
    outsider = await register('map-out@x.vn');
    fid = (await as(owner).post('/api/families', { name: 'Họ Lê', surname: 'Lê' })).body.id;
    await as(owner).post(`/api/families/${fid}/members`, { email: 'map-viewer@x.vn', role: 'viewer' }).expect(201);
    await as(owner).post(`/api/families/${fid}/members`, { email: 'map-member@x.vn', role: 'member' }).expect(201);
    dead = await person(owner, fid, 'Lê Văn Mộ', { generationRecorded: 1 });
    living = await person(owner, fid, 'Lê Văn Sống', { livingStatus: 'alive', generationRecorded: 2 });
  });

  it('stores exact burial locations for the deceased and shows them to everyone in the family', async () => {
    await as(owner)
      .post(`/api/families/${fid}/places`, { personId: dead, kind: 'burial', name: 'Nghĩa trang làng', note: 'Hàng 3, mộ thứ 5', lat: 21.0812345, lng: 105.7798765 })
      .expect(201);
    const res = await as(viewer).get(`/api/families/${fid}/places`).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ lat: 21.0812345, lng: 105.7798765, precision: 'exact', note: 'Hàng 3, mộ thứ 5', person: { displayName: 'Lê Văn Mộ' } });
  });

  it('rejects a grave for a living person', async () => {
    await as(owner).post(`/api/families/${fid}/places`, { personId: living, kind: 'burial', name: 'X', lat: 21, lng: 105 }).expect(400);
  });

  it('coarsens living people to ~10 km and hides them until verified, then only from members', async () => {
    const created = await as(owner)
      .post(`/api/families/${fid}/places`, { personId: living, kind: 'residence', name: 'Hà Đông, Hà Nội', note: 'số nhà 12', lat: 20.9712345, lng: 105.7765432 })
      .expect(201);
    expect(created.body).toMatchObject({ lat: 21, lng: 105.8, precision: 'coarse', note: null });

    // Chưa xác minh căn cứ: thành viên chưa thấy
    expect((await as(member).get(`/api/families/${fid}/places`)).body.some((p: any) => p.person?.id === living)).toBe(false);
    await as(owner).post(`/api/families/${fid}/persons/${living}/verify-basis`).expect(201);
    expect((await as(member).get(`/api/families/${fid}/places`)).body.some((p: any) => p.person?.id === living)).toBe(true);
    // Người xem (khách) không thấy vị trí người còn sống kể cả dạng che
    expect((await as(viewer).get(`/api/families/${fid}/places`)).body.some((p: any) => p.person?.id === living)).toBe(false);
  });

  it('filters by generation', async () => {
    const res = await as(owner).get(`/api/families/${fid}/places?generation=1`).expect(200);
    expect(res.body.every((p: any) => p.person?.generationRecorded === 1)).toBe(true);
  });

  it('allows family-level places without a person, but not mixed', async () => {
    await as(owner).post(`/api/families/${fid}/places`, { kind: 'ancestral_hall', name: 'Nhà thờ họ Lê', lat: 21.08, lng: 105.78 }).expect(201);
    await as(owner).post(`/api/families/${fid}/places`, { personId: dead, kind: 'ancestral_hall', name: 'X', lat: 21, lng: 105 }).expect(400);
    await as(owner).post(`/api/families/${fid}/places`, { kind: 'burial', name: 'X', lat: 21, lng: 105 }).expect(400);
  });

  it('isolates tenants and forbids viewers from editing', async () => {
    await as(outsider).get(`/api/families/${fid}/places`).expect(404);
    const other = (await as(outsider).post('/api/families', { name: 'Họ Khác', surname: 'Khác' })).body.id;
    await as(outsider).post(`/api/families/${other}/places`, { personId: dead, kind: 'burial', name: 'X', lat: 21, lng: 105 }).expect(404);
    await as(viewer).post(`/api/families/${fid}/places`, { kind: 'origin', name: 'X', lat: 21, lng: 105 }).expect(403);
  });

  it('records place changes in history and can revert a deletion', async () => {
    const list = await as(owner).get(`/api/families/${fid}/places`).expect(200);
    const hall = list.body.find((p: any) => p.kind === 'ancestral_hall');
    await as(owner).del(`/api/families/${fid}/places/${hall.id}`).expect(204);
    const history = await as(owner).get(`/api/families/${fid}/history`).expect(200);
    const del = history.body.find((h: any) => h.summary === 'Xóa địa điểm: Nhà thờ họ Lê');
    await as(owner).post(`/api/families/${fid}/history/${del.id}/revert`).expect(201);
    const after = await as(owner).get(`/api/families/${fid}/places`).expect(200);
    expect(after.body.some((p: any) => p.id === hall.id)).toBe(true);
  });
});
