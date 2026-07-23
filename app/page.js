import BroadcastForm from "@/components/BroadcastForm";
import AccountBar from "@/components/AccountBar";

export default function HomePage() {
  return (
    <main className="page-shell">
      <header className="page-header page-header-with-account">
        <div>
          <p className="page-eyebrow">Nội bộ · Gửi tin hàng loạt</p>
          <h1 className="page-title">Bảng điều khiển gửi tin nhắn</h1>
          <p className="page-subtitle">
            Chọn tài nguyên, danh sách người nhận và nội dung — hệ thống sẽ xử lý qua n8n.
          </p>
        </div>
        <AccountBar />
      </header>

      <BroadcastForm />
    </main>
  );
}
