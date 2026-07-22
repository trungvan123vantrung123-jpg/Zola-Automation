"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const FILTERS = [{ id:"all",label:"Tất cả"},{id:"processing",label:"Đang xử lý"},{id:"done",label:"Thành công"},{id:"error",label:"Thất bại"}];
const STATUS_LABEL = { processing:"Đang xử lý", done:"Thành công", error:"Thất bại" };

export default function JobHistory() {
  const [state,setState] = useState({ jobs:[],stats:{total:0,processing:0,done:0,error:0},page:1,total_pages:1 });
  const [filter,setFilter] = useState("all"); const [page,setPage] = useState(1); const [loading,setLoading] = useState(true); const [error,setError] = useState(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { const res=await fetch(`/api/jobs?status=${filter}&page=${page}`,{cache:"no-store"}); const data=await res.json(); if(!res.ok) throw new Error(data.error); setState(data); } catch(err){setError(err.message||"Không tải được dữ liệu.");} finally{setLoading(false);} },[filter,page]);
  useEffect(()=>{load();},[load]);
  function changeFilter(value){setFilter(value);setPage(1);}
  return <>
    <div className="history-stats"><Stat label="Tổng chiến dịch" value={state.stats.total} tone="neutral"/><Stat label="Đang xử lý" value={state.stats.processing} tone="warning"/><Stat label="Thành công" value={state.stats.done} tone="success"/><Stat label="Thất bại" value={state.stats.error} tone="danger"/></div>
    <section className="history-card" aria-labelledby="history-table-title">
      <div className="history-toolbar"><div><h2 id="history-table-title">Nhật ký chiến dịch</h2><p>Theo dõi toàn bộ lần gửi và mở lại báo cáo chi tiết.</p></div><button id="history-refresh" className="btn btn-secondary" type="button" onClick={load} disabled={loading}>↻ Làm mới</button></div>
      <div className="history-filters">{FILTERS.map(item=><button id={`history-filter-${item.id}`} key={item.id} type="button" onClick={()=>changeFilter(item.id)} className={filter===item.id?"active":""}>{item.label}</button>)}</div>
      {error && <div className="history-error">{error}</div>}
      <div className="result-table-scroll"><table className="history-table"><thead><tr><th>Thời gian</th><th>Tài nguyên</th><th>Người nhận</th><th>Nội dung</th><th>Trạng thái</th><th></th></tr></thead><tbody>
        {!loading && state.jobs.map(job=><tr key={job.id}><td><strong>{formatDate(job.created_at)}</strong><small>{formatTime(job.created_at)}</small></td><td><strong>{job.asset_name}</strong><small className="history-asset-id" title={job.asset_id}>ID: {job.asset_id}</small></td><td><b>{job.recipient_count}</b> số</td><td className="history-message" title={job.message_preview}>{job.message_preview||"—"}</td><td><span className={`history-status history-status-${job.status}`}><i/>{STATUS_LABEL[job.status]||job.status}</span></td><td><Link id={`open-job-${job.id}`} className="history-open" href={`/logs/${job.id}`}>{job.status==="done"?"Xem báo cáo":"Xem chi tiết"} →</Link></td></tr>)}
        {loading && Array.from({length:5},(_,i)=><tr key={i} className="history-skeleton"><td colSpan="6"><span/></td></tr>)}
      </tbody></table></div>
      {!loading && state.jobs.length===0 && <div className="result-empty"><span>◎</span><strong>Chưa có chiến dịch</strong><p>Không có log phù hợp với trạng thái đã chọn.</p></div>}
      <div className="history-pagination"><span>Trang {state.page} / {state.total_pages}</span><div><button id="history-prev" className="btn btn-ghost" disabled={page<=1||loading} onClick={()=>setPage(p=>p-1)}>← Trước</button><button id="history-next" className="btn btn-ghost" disabled={page>=state.total_pages||loading} onClick={()=>setPage(p=>p+1)}>Sau →</button></div></div>
    </section>
  </>;
}
function Stat({label,value,tone}){return <article className={`history-stat history-stat-${tone}`}><span>{label}</span><strong>{value}</strong></article>}
function formatDate(value){return new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeZone:"Asia/Ho_Chi_Minh"}).format(new Date(value))}
function formatTime(value){return new Intl.DateTimeFormat("vi-VN",{timeStyle:"short",timeZone:"Asia/Ho_Chi_Minh"}).format(new Date(value))}
