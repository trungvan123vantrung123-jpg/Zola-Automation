"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 3000;

/**
 * Hook quản lý việc polling trạng thái 1 job sau khi submit.
 * Dùng: const { jobState, startPolling, reset } = useJobPolling();
 * jobState: { jobId, status: "idle"|"processing"|"done"|"error", result, errorMessage }
 */
export function useJobPolling() {
  const [jobState, setJobState] = useState({
    jobId: null,
    status: "idle",
    result: null,
    errorMessage: null,
  });
  const intervalRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (jobId) => {
      stopPolling();
      setJobState({ jobId, status: "processing", result: null, errorMessage: null });

      intervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/status?job_id=${jobId}`);
          const data = await res.json();

          if (!res.ok) {
            setJobState((prev) => ({
              ...prev,
              status: "error",
              errorMessage: data.error || "Lỗi không xác định.",
            }));
            stopPolling();
            return;
          }

          if (data.status === "done") {
            setJobState({
              jobId,
              status: "done",
              result: data.result,
              errorMessage: null,
            });
            stopPolling();
          } else if (data.status === "error") {
            setJobState({
              jobId,
              status: "error",
              result: data.result,
              errorMessage: data.error_message || "Xử lý thất bại.",
            });
            stopPolling();
          }
          // Nếu vẫn "processing" -> giữ nguyên, chờ lần poll tiếp theo
        } catch (err) {
          // Lỗi mạng tạm thời -> không dừng polling ngay, thử lại ở lần sau
          console.error("[useJobPolling] Lỗi khi poll:", err.message);
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling]
  );

  const reset = useCallback(() => {
    stopPolling();
    setJobState({ jobId: null, status: "idle", result: null, errorMessage: null });
  }, [stopPolling]);

  useEffect(() => stopPolling, [stopPolling]);

  return { jobState, startPolling, reset };
}
