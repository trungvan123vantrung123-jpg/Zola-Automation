"use client";

import { useMemo, useState } from "react";

const FILTERS = [
  { id: "all", label: "Tất cả" },
  { id: "completed", label: "Hoàn tất" },
  { id: "incomplete", label: "Chưa hoàn tất" },
];

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function StatusBadge({ success }) {
  return (
    <span className={`result-status ${success ? "result-status-success" : "result-status-pending"}`}>
      <span className="result-status-dot" aria-hidden="true" />
      {success ? "Đã gửi" : "Chưa gửi"}
    </span>
  );
}

export default function JobResultDashboard({ result, jobId }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const details = Array.isArray(result?.details) ? result.details : [];
  const summary = result?.summary && typeof result.summary === "object" ? result.summary : {};
  const total = asNumber(summary.total, details.length);
  const friendSent = asNumber(summary.total_add_friend_sent, details.filter((item) => item?.send_add_friend_request === true).length);
  const messageSent = asNumber(summary.total_first_message_sent, details.filter((item) => item?.send_first_message === true).length);
  const completed = details.filter((item) => item?.send_add_friend_request === true && item?.send_first_message === true).length;
  const progress = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  const filteredDetails = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return details.filter((item) => {
      const isCompleted = item?.send_add_friend_request === true && item?.send_first_message === true;
      const matchesFilter = filter === "all" || (filter === "completed" && isCompleted) || (filter === "incomplete" && !isCompleted);
      return matchesFilter && String(item?.user_number ?? "").toLowerCase().includes(normalizedQuery);
    });
  }, [details, filter, query]);

  let generatedAt = null;
  if (summary.generated_at) {
    const date = new Date(summary.generated_at);
    if (!Number.isNaN(date.getTime())) {
      generatedAt = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" }).format(date);
    }
  }

  return (
    <section className="result-dashboard" aria-labelledby="result-dashboard-title">
      <div className="result-heading-row">
        <div>
          <p className="result-kicker">Báo cáo chiến dịch</p>
          <h2 id="result-dashboard-title" className="result-title">Kết quả gửi tin nhắn</h2>
          <p className="result-meta">Job <code>{jobId}</code>{generatedAt ? ` · Cập nhật ${generatedAt}` : ""}</p>
        </div>
        <span className="result-complete-pill">✓ Đã xử lý xong</span>
      </div>

      <div className="result-metrics">
        <MetricCard label="Tổng người nhận" value={total} tone="neutral" />
        <MetricCard label="Đã gửi kết bạn" value={friendSent} total={total} tone="violet" />
        <MetricCard label="Đã gửi tin nhắn" value={messageSent} total={total} tone="cyan" />
        <MetricCard label="Hoàn tất cả hai" value={completed} total={total} tone="success" />
      </div>

      <div className="result-progress-block">
        <div className="result-progress-label"><span>Tiến độ hoàn tất</span><strong>{progress}%</strong></div>
        <div className="result-progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
          <span className="result-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="result-table-card">
        <div className="result-toolbar">
          <label className="result-search-wrap" htmlFor="result-phone-search">
            <span aria-hidden="true">⌕</span>
            <input id="result-phone-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm số điện thoại..." className="result-search" />
          </label>
          <div className="result-filters" aria-label="Lọc trạng thái">
            {FILTERS.map((item) => (
              <button id={`result-filter-${item.id}`} key={item.id} type="button" className={`result-filter-btn ${filter === item.id ? "result-filter-btn-active" : ""}`} onClick={() => setFilter(item.id)} aria-pressed={filter === item.id}>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="result-table-scroll">
          <table className="result-table">
            <thead><tr><th scope="col">STT</th><th scope="col">Số điện thoại</th><th scope="col">Lời mời kết bạn</th><th scope="col">Tin nhắn đầu tiên</th><th scope="col">Tình trạng</th></tr></thead>
            <tbody>
              {filteredDetails.map((item, index) => {
                const isCompleted = item?.send_add_friend_request === true && item?.send_first_message === true;
                return (
                  <tr key={`${item?.user_number ?? "unknown"}-${index}`}>
                    <td className="result-index">{String(index + 1).padStart(2, "0")}</td>
                    <td className="result-phone">{item?.user_number || "Không xác định"}</td>
                    <td><StatusBadge success={item?.send_add_friend_request === true} /></td>
                    <td><StatusBadge success={item?.send_first_message === true} /></td>
                    <td><span className={`result-overall ${isCompleted ? "result-overall-done" : "result-overall-attention"}`}>{isCompleted ? "Hoàn tất" : "Cần kiểm tra"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredDetails.length === 0 && <div className="result-empty"><span aria-hidden="true">◎</span><strong>Không tìm thấy kết quả</strong><p>Thử thay đổi từ khóa hoặc bộ lọc trạng thái.</p></div>}
        <div className="result-table-footer">Hiển thị <strong>{filteredDetails.length}</strong> / {details.length} số điện thoại</div>
      </div>
    </section>
  );
}

function MetricCard({ label, value, total, tone }) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : null;
  return <article className={`result-metric result-metric-${tone}`}><span className="result-metric-label">{label}</span><div className="result-metric-value-row"><strong>{value}</strong>{percentage !== null && <span>{percentage}%</span>}</div></article>;
}
