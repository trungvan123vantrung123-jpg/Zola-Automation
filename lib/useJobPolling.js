"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const INITIAL_DELAY_MS = 3000;
const MAX_DELAY_MS = 15000;
const MAX_POLL_DURATION_MS = 10 * 60 * 1000;
const idleState = { jobId: null, status: "idle", result: null, errorMessage: null };

export function useJobPolling() {
  const [jobState, setJobState] = useState(idleState);
  const timerRef = useRef(null);
  const generationRef = useRef(0);

  const stopPolling = useCallback(() => {
    generationRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const startPolling = useCallback((jobId) => {
    stopPolling();
    const generation = generationRef.current;
    const startedAt = Date.now();
    let delay = INITIAL_DELAY_MS;
    setJobState({ jobId, status: "processing", result: null, errorMessage: null });

    const poll = async () => {
      if (generation !== generationRef.current) return;
      if (Date.now() - startedAt >= MAX_POLL_DURATION_MS) {
        setJobState((current) => ({ ...current, status: "pending_review", errorMessage: "Đã dừng cập nhật tự động. Chiến dịch vẫn có thể đang xử lý; hãy xem lại trong Lịch sử hoạt động." }));
        return;
      }
      try {
        const res = await fetch(`/api/status?job_id=${encodeURIComponent(jobId)}`, { cache: "no-store" });
        if (res.status === 401) {
          window.location.assign("/login");
          return;
        }
        const data = await res.json();
        if (res.ok && data.status === "done") {
          setJobState({ jobId, status: "done", result: data.result, errorMessage: null });
          return;
        }
        if (res.ok && data.status === "error") {
          setJobState({ jobId, status: "error", result: data.result, errorMessage: data.error_message || "Xử lý thất bại." });
          return;
        }
        delay = res.ok ? INITIAL_DELAY_MS : Math.min(delay * 2, MAX_DELAY_MS);
      } catch (error) {
        console.error("[useJobPolling] Lỗi tạm thời:", error.message);
        delay = Math.min(delay * 2, MAX_DELAY_MS);
      }
      if (generation === generationRef.current) timerRef.current = setTimeout(poll, delay);
    };

    poll();
  }, [stopPolling]);

  const reset = useCallback(() => {
    stopPolling();
    setJobState(idleState);
  }, [stopPolling]);

  useEffect(() => stopPolling, [stopPolling]);
  return { jobState, startPolling, reset };
}
