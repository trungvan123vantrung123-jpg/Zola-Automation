"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import JobResultDashboard from "./JobResultDashboard";
const LABEL={processing:"Đang xử lý",done:"Thành công",error:"Thất bại"};
export default function JobLogDetail({jobId}){
 const [job,setJob]=useState(null),[error,setError]=useState(null),[loading,setLoading]=useState(true);
 const load=useCallback(async()=>{try{const res=await fetch(`/api/jobs/${jobId}`,{cache:"no-store"});const data=await res.json();if(!res.ok)throw new Error(data.error);setJob(data);setError(null);}catch(err){setError(err.message||"Không tải được log.");}finally{setLoading(false);}},[jobId]);
 useEffect(()=>{load();},[load]); useEffect(()=>{if(job?.status!=="processing")return;const timer=setInterval(load,3000);return()=>clearInterval(timer)},[job?.status,load]);
 if(loading)return <div className="detail-loading">Đang tải dữ liệu log...</div>; if(error)return <div className="status-banner status-banner-error">{error}</div>; if(!job)return null;
 const assetId=job.input?.asset_id||"Không xác định";
 return <><section className="detail-summary"><div><span>TRẠNG THÁI CHIẾN DỊCH</span><h2>{job.input?.asset_name||"Không xác định"}</h2><p className="detail-asset-id">Asset ID: <code>{assetId}</code></p><p>{job.input?.user_number_list?.length||0} người nhận · Tạo lúc {formatDate(job.created_at)}</p></div><span className={`history-status history-status-${job.status}`}><i/>{LABEL[job.status]}</span></section>
 {job.status==="done"&&<JobResultDashboard result={job.result} jobId={job.id}/>} {job.status==="processing"&&<div className="status-banner status-banner-processing detail-state">Chiến dịch đang được xử lý. Trang tự cập nhật mỗi 3 giây.</div>} {job.status==="error"&&<div className="status-banner status-banner-error detail-state"><strong>Chiến dịch thất bại</strong><p>{job.error_message||"Không có thông tin lỗi."}</p></div>}</>;
}
function formatDate(v){return new Intl.DateTimeFormat("vi-VN",{dateStyle:"medium",timeStyle:"medium",timeZone:"Asia/Ho_Chi_Minh"}).format(new Date(v))}
