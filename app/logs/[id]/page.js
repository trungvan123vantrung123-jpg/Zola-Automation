import Link from "next/link";
import JobLogDetail from "@/components/JobLogDetail";
export const metadata={title:"Chi tiết chiến dịch | Zola Automation",description:"Chi tiết trạng thái và kết quả chiến dịch gửi tin nhắn."};
export default function LogDetailPage({params}){return <main className="page-shell detail-page"><Link id="back-to-history" href="/logs" className="detail-back">← Quay lại lịch sử</Link><h1 className="sr-only">Chi tiết chiến dịch</h1><JobLogDetail jobId={params.id}/></main>}
