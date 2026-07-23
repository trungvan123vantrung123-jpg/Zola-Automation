"use client";

import { useEffect, useState } from "react";

export default function AdminPanel() {
  const [secret, setSecret] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("admin_secret");
    if (saved) {
      setSecret(saved);
      setUnlocked(true);
    }
  }, []);

  useEffect(() => {
    if (unlocked) loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  async function loadCustomers() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/customers", {
        headers: { "x-admin-secret": secret },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Không tải được danh sách.");
        setUnlocked(false);
        sessionStorage.removeItem("admin_secret");
        return;
      }
      setCustomers(data.customers);
      sessionStorage.setItem("admin_secret", secret);
      setUnlocked(true);
    } catch (err) {
      setError("Không kết nối được máy chủ.");
    } finally {
      setLoading(false);
    }
  }

  function handleUnlock(e) {
    e.preventDefault();
    if (!secret.trim()) return;
    loadCustomers();
  }

  async function updateCustomer(customerId, fields) {
    setError(null);
    try {
      const res = await fetch("/api/admin/customers", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ customer_id: customerId, ...fields }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Cập nhật thất bại.");
        return;
      }
      setCustomers((prev) =>
        prev.map((c) => (c.id === customerId ? { ...c, ...data.customer } : c))
      );
    } catch (err) {
      setError("Không kết nối được máy chủ.");
    }
  }

  if (!unlocked) {
    return (
      <form className="auth-card" onSubmit={handleUnlock}>
        <h1 className="auth-title">Quản trị</h1>
        <label className="auth-field">
          <span>Admin secret</span>
          <input
            type="password"
            className="select-input"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            required
          />
        </label>
        {error && <p className="field-error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-lg">
          Vào trang quản trị
        </button>
      </form>
    );
  }

  return (
    <div className="admin-shell">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">Quản trị</p>
          <h1 className="page-title">Danh sách khách hàng</h1>
        </div>
        <button
          id="admin-lock-session"
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            sessionStorage.removeItem("admin_secret");
            setSecret("");
            setCustomers([]);
            setUnlocked(false);
          }}
        >
          Khoá phiên quản trị
        </button>
      </header>

      {error && <p className="field-error">{error}</p>}
      {loading && <p className="field-hint">Đang tải...</p>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Trạng thái</th>
              <th>Quota (đã dùng/tổng)</th>
              <th>Ghi chú</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <CustomerRow key={c.id} customer={c} onUpdate={updateCustomer} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomerRow({ customer, onUpdate }) {
  const [quotaInput, setQuotaInput] = useState(customer.quota_limit);

  return (
    <tr>
      <td>{customer.email}</td>
      <td>
        <span className={`status-pill status-pill-${customer.status}`}>{customer.status}</span>
      </td>
      <td>
        {customer.quota_used} / {customer.quota_limit}
      </td>
      <td className="admin-note-cell">{customer.note || "—"}</td>
      <td className="admin-actions-cell">
        {customer.status === "pending" && (
          <div className="admin-action-row">
            <input
              type="number"
              min={0}
              className="number-input"
              value={quotaInput}
              onChange={(e) => setQuotaInput(Number(e.target.value))}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onUpdate(customer.id, { status: "active", quota_limit: quotaInput })}
            >
              Duyệt
            </button>
          </div>
        )}

        {customer.status === "active" && (
          <div className="admin-action-row">
            <input
              type="number"
              min={0}
              className="number-input"
              value={quotaInput}
              onChange={(e) => setQuotaInput(Number(e.target.value))}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onUpdate(customer.id, { quota_limit: quotaInput })}
            >
              Cập nhật quota
            </button>
            <button
              type="button"
              className="btn btn-danger-outline"
              onClick={() => onUpdate(customer.id, { status: "disabled" })}
            >
              Khoá
            </button>
          </div>
        )}

        {(customer.status === "disabled" || customer.status === "exhausted") && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onUpdate(customer.id, { status: "active" })}
          >
            Kích hoạt lại
          </button>
        )}
      </td>
    </tr>
  );
}
