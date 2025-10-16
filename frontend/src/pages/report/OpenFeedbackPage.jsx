import React, { useState } from "react";
import MainLayout from "../../layouts/MainLayout";
import "./OpenFeedbackPage.css";
// import { Search } from "lucide-react";

const mockResponses = [
  { id: 1, author: "Người tham gia 1", text: "Dịch vụ khá tốt nhưng giá hơi cao so với thị trường. Nhân viên thân thiện và nhiệt tình.", time: "2 phút trước" },
  { id: 2, author: "Người tham gia 2", text: "Nhân viên thân thiện, nhưng thời gian chờ đợi hơi lâu. Hy vọng sẽ cải thiện trong tương lai.", time: "5 phút trước" },
  { id: 3, author: "Ẩn danh", text: "Chất lượng sản phẩm ổn, giao hàng đúng hẹn. Tuy nhiên ứng dụng mobile chạy hơi chậm.", time: "8 phút trước" },
  { id: 4, author: "Người tham gia 4", text: "Rất hài lòng với dịch vụ. Nhân viên giải quyết vấn đề nhanh chóng và chuyên nghiệp.", time: "12 phút trước" },
];

const OpenFeedbackPage = () => {
  const [search, setSearch] = useState("");

  const filteredResponses = mockResponses.filter((r) =>
    r.text.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="analysis-container">
        {/* HEADER */}
        <div className="analysis-header">
          <h1>Phân tích phản hồi mở</h1>
          <p>Xem các câu trả lời dạng văn bản và phân tích từ AI</p>

          {/* <div className="search-bar">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Tìm kiếm trong phản hồi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div> */}
        </div>

        {/* ORIGINAL RESPONSES */}
        <section className="response-section">
          <h2>💬 Phản hồi gốc từ người tham gia</h2>
          <p className="response-count">{filteredResponses.length} phản hồi</p>
          <div className="response-list">
            {filteredResponses.map((r) => (
              <div key={r.id} className="response-card">
                <div className="response-author">
                  <div className="author-avatar">{r.author.charAt(0)}</div>
                  <div>
                    <strong>{r.author}</strong>
                    <p className="response-time">{r.time}</p>
                  </div>
                </div>
                <p className="response-text">{r.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* AI ANALYSIS */}
        <section className="ai-analysis">
          <h2>🤖 Phân tích AI</h2>

          <div className="ai-card">
            <h3>🧠 Tóm tắt ý chính</h3>
            <p className="ai-summary">
              <span className="highlight">chờ đợi lâu</span> và{" "}
              <span className="highlight">giá cả hơi cao</span>. Khách hàng mong muốn{" "}
              <span className="highlight">cải thiện ứng dụng mobile</span> và{" "}
              <span className="highlight">hỗ trợ kỹ thuật</span>.
            </p>
          </div>

          <div className="ai-card">
            <h3>🏷️ Từ khóa phổ biến</h3>
            <div className="tag-list">
              {["dịch vụ tốt", "nhân viên nhiệt tình", "thời gian chờ", "giá cả cao", "ứng dụng mobile", "hỗ trợ kỹ thuật", "chất lượng"].map(
                (tag, idx) => (
                  <span key={idx} className="tag">
                    {tag}
                  </span>
                )
              )}
            </div>
          </div>

          <div className="ai-card">
            <h3>📊 Cụm từ tiêu biểu</h3>
            <div className="cluster-grid">
              <div className="cluster positive">
                <h4>✅ Tích cực</h4>
                <ul>
                  <li>"Dịch vụ rất tốt"</li>
                  <li>"Nhân viên thân thiện"</li>
                  <li>"Giải quyết nhanh chóng"</li>
                </ul>
              </div>
              <div className="cluster negative">
                <h4>⚠️ Cần cải thiện</h4>
                <ul>
                  <li>"Thời gian chờ hơi lâu"</li>
                  <li>"Giá cả hơi cao"</li>
                  <li>"Ứng dụng mobile chậm"</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="ai-card">
            <h3>💡 Gợi ý hành động</h3>
            <ul className="action-list">
              <li>
                <b>Ưu tiên cao:</b> Rút ngắn thời gian chờ của khách hàng tại điểm dịch vụ.
              </li>
              <li>
                <b>Trung hạn:</b> Cải thiện hiệu năng ứng dụng mobile.
              </li>
              <li>
                <b>Dài hạn:</b> Đánh giá lại cấu trúc giá để tăng sức cạnh tranh.
              </li>
            </ul>
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default OpenFeedbackPage;
