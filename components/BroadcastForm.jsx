"use client";

import { useMemo, useState } from "react";
import AssetSelector from "./AssetSelector";
import UserListInput from "./UserListInput";
import MessageComposer from "./MessageComposer";
import AttachmentUploader from "./AttachmentUploader";
import SpeedControl from "./SpeedControl";
import JobResultDashboard from "./JobResultDashboard";
import { validateUserList, MAX_USER_COUNT } from "@/lib/userListParser";
import { useJobPolling } from "@/lib/useJobPolling";

const initialState = {
  asset: null, // { asset_id, asset_name }
  userList: [], // string[]
  content: "",
  aiAutoSpin: false,
  attachments: [], // { url, name }[]
  speedMin: 1,
  speedMax: 2,
};

export default function BroadcastForm() {
  const [form, setForm] = useState(initialState);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const { jobState, startPolling, reset } = useJobPolling();

  const userListValidation = useMemo(
    () => validateUserList(form.userList),
    [form.userList]
  );

  const canSubmit =
    !!form.asset &&
    userListValidation.valid &&
    form.userList.length > 0 &&
    form.content.trim().length > 0 &&
    form.speedMax >= form.speedMin &&
    !submitting &&
    !uploadingAttachments &&
    jobState.status !== "processing";

  function buildPayload() {
    return {
      asset_id: form.asset.asset_id,
      asset_name: form.asset.asset_name,
      user_number_list: form.userList,
      message: {
        content: form.content,
        ai_auto_spin: form.aiAutoSpin,
      },
      attachments: form.attachments.map((attachment) => ({
        url: attachment.url,
        name: attachment.name,
        bucket: attachment.bucket || "attachments",
        path: attachment.path,
        size: attachment.size,
      })),
      speed_min: form.speedMin,
      speed_max: form.speedMax,
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError(null);

    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || "Gửi yêu cầu thất bại.");
        return;
      }

      startPolling(data.job_id);
    } catch (err) {
      setSubmitError("Không kết nối được máy chủ.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset() {
    const uploadedPaths = form.attachments.map((attachment) => attachment.path).filter(Boolean);
    setForm(initialState);
    setSubmitError(null);
    reset();

    await Promise.allSettled(
      uploadedPaths.map((path) =>
        fetch("/api/delete-attachment", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
        })
      )
    );
  }

  return (
    <form className="broadcast-form" onSubmit={handleSubmit}>
      <AssetSelector
        value={form.asset?.asset_id}
        onChange={(asset) => setForm((f) => ({ ...f, asset }))}
      />

      <UserListInput
        userList={form.userList}
        onChange={(userList) => setForm((f) => ({ ...f, userList }))}
      />

      <MessageComposer
        content={form.content}
        onChange={(content) => setForm((f) => ({ ...f, content }))}
        aiAutoSpin={form.aiAutoSpin}
        onAiAutoSpinChange={(aiAutoSpin) => setForm((f) => ({ ...f, aiAutoSpin }))}
      />

      <AttachmentUploader
        attachments={form.attachments}
        onChange={(attachments) => setForm((f) => ({ ...f, attachments }))}
        onUploadingChange={setUploadingAttachments}
      />

      <SpeedControl
        speedMin={form.speedMin}
        speedMax={form.speedMax}
        onChange={({ speedMin, speedMax }) =>
          setForm((f) => ({ ...f, speedMin, speedMax }))
        }
      />

      <div className="submit-bar">
        <button type="submit" className="btn btn-primary btn-lg" disabled={!canSubmit}>
          {submitting ? "Đang gửi yêu cầu..." : uploadingAttachments ? "Đang upload ảnh..." : "Gửi tin nhắn"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={handleReset}>
          Làm mới form
        </button>
      </div>

      {submitError && <p className="field-error submit-error">{submitError}</p>}

      <JobStatusBanner jobState={jobState} maxUserCount={MAX_USER_COUNT} />
    </form>
  );
}

function JobStatusBanner({ jobState }) {
  if (jobState.status === "idle") return null;

  if (jobState.status === "processing") {
    return (
      <div className="status-banner status-banner-processing">
        Đang xử lý yêu cầu (job <code>{jobState.jobId}</code>)... Trang sẽ tự cập nhật khi xong.
      </div>
    );
  }

  if (jobState.status === "done") {
    return <JobResultDashboard result={jobState.result} jobId={jobState.jobId} />;
  }

  if (jobState.status === "pending_review") {
    return (
      <div className="status-banner status-banner-processing">
        {jobState.errorMessage}
      </div>
    );
  }

  if (jobState.status === "error") {
    return (
      <div className="status-banner status-banner-error">
        Xử lý thất bại: {jobState.errorMessage}
      </div>
    );
  }

  return null;
}
