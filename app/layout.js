import "./globals.css";
import AppNavigation from "@/components/AppNavigation";

export const metadata = {
  title: "Bảng điều khiển gửi tin nhắn",
  description: "Giao diện nội bộ gửi dữ liệu sang n8n để xử lý gửi tin hàng loạt.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>
        <AppNavigation />
        {children}
      </body>
    </html>
  );
}
