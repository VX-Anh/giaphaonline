import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth';
import { Header } from '@/components/Header';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gia Phả Online',
  description: 'Số hóa, lưu giữ và kết nối gia phả dòng họ Việt Nam',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Noto+Serif:wght@600;700&display=swap"
        />
      </head>
      <body>
        <AuthProvider>
          <Header />
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
