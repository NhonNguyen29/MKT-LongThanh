import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Sao Việt · Marketing Hub",
  description:
    "Điều hành Marketing, giao việc và duyệt nội dung Sao Việt Long Thành",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
