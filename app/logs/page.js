import JobHistory from "@/components/JobHistory";
export const metadata={title:"Lịch sử hoạt động | Zola Automation",description:"Theo dõi trạng thái và kết quả các chiến dịch gửi tin nhắn."};
export default function LogsPage(){return <main className="page-shell history-page"><header className="page-header"><p className="page-eyebrow">TRUNG TÂM HOẠT ĐỘNG</p><h1 className="page-title">Lịch sử chiến dịch</h1><p className="page-subtitle">Kiểm tra trạng thái, tiến độ và kết quả của mọi lần gửi tin nhắn.</p></header><JobHistory/></main>}
