// Tạo dữ liệu mẫu qua API đang chạy: node scripts/seed-demo.mjs [apiUrl]
// Tài khoản demo (chỉ dùng cho môi trường dev):
//   email:    demo@giapha.test
//   mật khẩu: demo-giapha-2026
const API = process.argv[2] ?? 'http://localhost:4000/api';
const DEMO = { email: 'demo@giapha.test', password: 'demo-giapha-2026', fullName: 'Nguyễn Văn Demo' };

async function call(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data;
}

let auth;
try {
  auth = await call('/auth/register', DEMO);
} catch {
  auth = await call('/auth/login', { email: DEMO.email, password: DEMO.password });
}
const t = auth.accessToken;
const fam = await call('/families', { name: 'Họ Nguyễn Văn - làng Đông Ngạc', surname: 'Nguyễn', originPlace: 'Đông Ngạc, Từ Liêm, Hà Nội' }, t);
const f = `/families/${fam.id}`;

const lunar = (day, month, year = null) => ({ calendar: 'lunar', day, month, year });
const add = (name, extra = {}) =>
  call(`${f}/persons`, { gender: 'male', livingStatus: 'deceased', names: [{ valueVi: name, isPrimary: true }], ...extra }, t).then((p) => p.id);

const toTien = await add('Nguyễn Văn Phúc', { generationRecorded: 1, deathDate: lunar(12, 3, 1850), biography: 'Thủy tổ, lập nghiệp tại làng Đông Ngạc.' });
const baTo = await add('Trần Thị Hiền', { gender: 'female', deathDate: lunar(5, 8, 1862) });
const con1 = await add('Nguyễn Văn Đức', { generationRecorded: 2, siblingOrder: 1, deathDate: lunar(20, 10, 1898) });
const con2 = await add('Nguyễn Văn Thịnh', { generationRecorded: 2, siblingOrder: 2, deathDate: lunar(1, 6) });
const chau1 = await add('Nguyễn Văn Lộc', { generationRecorded: 3, deathDate: lunar(15, 1, 1945) });
const chau2 = await add('Nguyễn Thị Lan', { gender: 'female', generationRecorded: 3, deathDate: lunar(30, 12) });
const chat = await add('Nguyễn Văn An', { generationRecorded: 4, livingStatus: 'alive', birthDate: { calendar: 'solar', year: 1975, month: 4, day: 2 } });

await call(`${f}/unions`, { partner1Id: toTien, partner2Id: baTo, unionLabel: 'chính thất' }, t);
for (const [p, c] of [[toTien, con1], [baTo, con1], [toTien, con2], [baTo, con2], [con1, chau1], [con1, chau2], [chau1, chat]]) {
  await call(`${f}/parent-child`, { parentId: p, childId: c }, t);
}
// Địa điểm mẫu quanh làng Đông Ngạc (tọa độ minh họa)
const place = (body) => call(`${f}/places`, body, t);
await place({ kind: 'ancestral_hall', name: 'Nhà thờ họ Nguyễn Văn', note: 'Cạnh đình làng Đông Ngạc', lat: 21.0886, lng: 105.7781 });
await place({ kind: 'origin', name: 'Làng Đông Ngạc', lat: 21.0905, lng: 105.7745 });
await place({ personId: toTien, kind: 'burial', name: 'Nghĩa trang thôn Đông', note: 'Khu mộ tổ, hàng đầu tiên', lat: 21.0931, lng: 105.7812 });
await place({ personId: baTo, kind: 'burial', name: 'Nghĩa trang thôn Đông', note: 'Bên phải mộ cụ ông', lat: 21.09315, lng: 105.78135 });
await place({ personId: con1, kind: 'reburial', name: 'Nghĩa trang Thanh Tước', note: 'Cải táng năm 1950', lat: 21.2335, lng: 105.7046 });
await place({ personId: chau1, kind: 'burial', name: 'Nghĩa trang Văn Điển', lat: 20.9459, lng: 105.8426 });
await place({ personId: chau2, kind: 'birth', name: 'Đông Ngạc, Từ Liêm', lat: 21.0889, lng: 105.776 });
// Người còn sống: tọa độ sẽ bị làm tròn ~10 km
await place({ personId: chat, kind: 'residence', name: 'Thành phố Hồ Chí Minh', lat: 10.7769, lng: 106.7009 });

console.log(`Đã tạo dòng họ ${fam.name} (${fam.id}) cho ${DEMO.email}`);
