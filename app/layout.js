import "./globals.css";
import AppNavigation from "@/components/AppNavigation";
import { Be_Vietnam_Pro } from "next/font/google";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal"],
  display: "swap",
  variable: "--font-be-vietnam-pro",
});

export const metadata = {
  title: "Bảng điều khiển gửi tin nhắn",
  description: "Giao diện nội bộ gửi dữ liệu sang n8n để xử lý gửi tin hàng loạt.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body className={beVietnamPro.variable}>
        <AppNavigation />
        {children}
      </body>
    </html>
  );
}
