"use client";

import { useEffect, useState } from "react";

export default function AdminPanel() {
  const [secret, setSecret] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [assets, setAssets] = useState([]);
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
      const [customersResponse, assetsResponse] = await Promise.all([
        fetch("/api/admin/customers", { headers: { "x-admin-secret": secret } }),
        fetch("/api/admin/assets", { headers: { "x-admin-secret": secret } }),
      ]);
      const [customerData, assetData] = await Promise.all([customersResponse.json(), assetsResponse.json()]);
      if (!customersResponse.ok || !assetsResponse.ok) {
        setError(customerData.error || assetData.error || "Không tải được danh sách.");
        setUnlocked(false);
        sessionStorage.removeItem("admin_secret");
        return;
      }
      setCustomers(customerData.customers);
      setAssets(assetData.assets);
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

  async function updateAssetOwner(assetId, ownerId) {
    setError(null);
    try {
      const res = await fetch("/api/admin/assets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ asset_id: assetId, owner_id: ownerId || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Cập nhật chủ sở hữu thất bại."); return; }
      setAssets((previous) => previous.map((asset) => asset.asset_id === assetId ? data.asset : asset));
    } catch {
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
            setAssets([]);
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

      <section className="admin-table-wrap" aria-labelledby="admin-assets-title">
        <div className="result-heading-row">
          <div>
            <p className="page-eyebrow">Phân vùng tài nguyên</p>
            <h2 id="admin-assets-title" className="panel-title">Gán chủ sở hữu asset</h2>
          </div>
        </div>
        <table className="admin-table">
          <thead><tr><th>Tài nguyên</th><th>Trạng thái</th><th>Chủ sở hữu</th><th>Hành động</th></tr></thead>
          <tbody>
            {assets.map((asset) => <AssetOwnerRow key={asset.asset_id} asset={asset} customers={customers} onUpdate={updateAssetOwner} />)}
          </tbody>
        </table>
        {!assets.length && <p className="field-hint">Chưa có tài nguyên nào.</p>}
      </section>
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

function AssetOwnerRow({ asset, customers, onUpdate }) {
  const [ownerId, setOwnerId] = useState(asset.owner_id || "");
  return (
    <tr>
      <td>{asset.asset_name} <code>{asset.asset_id}</code></td>
      <td><span className={`status-pill status-pill-${asset.status}`}>{asset.status}</span></td>
      <td>
        <select className="select-input" value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
          <option value="">Ch�a g�n � kh�ng kh? d?ng</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.email}</option>)}
        </select>
      </td>
      <td className="admin-actions-cell"><button type="button" className="btn btn-secondary" onClick={() => onUpdate(asset.asset_id, ownerId)}>L�u ch? s? h?u</button></td>
    </tr>
  );
}
