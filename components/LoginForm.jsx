"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setSubmitting(false);

    if (signInError) {
      setError(translateAuthError(signInError.message));
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      <h1 className="auth-title">Đăng nhập</h1>

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
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="select-input"
          placeholder="••••••••"
        />
      </label>

      {error && <p className="field-error">{error}</p>}

      <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
        {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>

      <p className="auth-switch">
        Chưa có tài khoản? <a href="/register">Đăng ký demo</a>
      </p>
    </form>
  );
}

function translateAuthError(message) {
  if (message.includes("Invalid login credentials")) return "Email hoặc mật khẩu không đúng.";
  if (message.includes("Email not confirmed")) return "Email chưa được xác thực. Vui lòng kiểm tra hộp thư.";
  return "Đăng nhập thất bại. Vui lòng thử lại.";
}
