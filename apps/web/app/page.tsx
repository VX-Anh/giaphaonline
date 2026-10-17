'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';

export default function Home() {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && user) router.replace('/families');
  }, [ready, user, router]);

  return (
    <section className="py-10 text-center">
      <h1 className="font-serif text-4xl font-bold text-primary sm:text-5xl">Gìn giữ cội nguồn dòng họ</h1>
      <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">
        Số hóa gia phả, vẽ cây phả hệ nhiều đời, nhắc ngày giỗ theo âm lịch và kết nối con cháu ở mọi nơi. Thông tin
        người còn sống được bảo vệ mặc định.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/login?mode=register" className="min-h-11 rounded-lg bg-primary px-6 py-3 font-medium text-white hover:bg-primary-hover">
          Tạo gia phả miễn phí
        </Link>
        <Link href="/login" className="min-h-11 rounded-lg border border-gold/40 bg-gold-soft px-6 py-3 font-medium">
          Đăng nhập
        </Link>
      </div>
      <div className="mt-14 grid gap-4 text-left sm:grid-cols-3">
        {[
          ['Cây phả hệ', 'Xem theo dạng cây hoặc danh sách thụt lề, phù hợp cả người lớn tuổi.'],
          ['Lịch giỗ âm lịch', 'Tự tính ngày giỗ hằng năm, xử lý tháng nhuận và tháng thiếu.'],
          ['An toàn & riêng tư', 'Người còn sống được che với khách; mọi thay đổi đều có lịch sử và hoàn tác.'],
        ].map(([t, d]) => (
          <div key={t} className="rounded-xl border border-line bg-card p-5">
            <h2 className="font-serif text-xl font-bold text-primary">{t}</h2>
            <p className="mt-2 text-muted">{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
