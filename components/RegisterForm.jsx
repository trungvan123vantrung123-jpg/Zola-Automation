"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Mật khẩu cần tối thiểu 6 ký tự.");
      return;
    }

    setSubmitting(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setSubmitting(false);

    if (signUpError) {
      setError(translateAuthError(signUpError.message));
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="auth-card">
        <h1 className="auth-title">Kiểm tra email của bạn</h1>
        <p className="auth-text">
          Mình đã gửi 1 email xác nhận tới <strong>{email}</strong>. Vui lòng bấm vào link
          trong email để xác thực tài khoản.
        </p>
        <p className="auth-text field-hint">
          Sau khi xác thực, tài khoản sẽ ở trạng thái chờ duyệt — quản trị viên sẽ cấp lượt
          dùng demo trong thời gian sớm nhất.
        </p>
      </div>
    );
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      <h1 className="auth-title">Đăng ký tài khoản demo</h1>

      <label className="auth-field">
        <span>Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="select-input"
          placeholder="ban@congty.com"
        />
      </label>

      <label className="auth-field">
        <span>Mật khẩu</span>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="select-input"
          placeholder="Tối thiểu 6 ký tự"
        />
      </label>

      {error && <p className="field-error">{error}</p>}

      <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
        {submitting ? "Đang tạo tài khoản..." : "Đăng ký"}
      </button>

      <p className="auth-switch">
        Đã có tài khoản? <a href="/login">Đăng nhập</a>
      </p>
    </form>
  );
}

function translateAuthError(message) {
  if (message.includes("already registered")) return "Email này đã được đăng ký.";
  if (message.includes("Password")) return "Mật khẩu không hợp lệ.";
  return "Đăng ký thất bại. Vui lòng thử lại.";
}
