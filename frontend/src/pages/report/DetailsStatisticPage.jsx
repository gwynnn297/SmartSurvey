import React from "react";
import MainLayout from "../../layouts/MainLayout";
import "./DetailsStatisticPage.css";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
} from "recharts";

const COLORS = ["#22c55e", "#facc15", "#ef4444"];

const DetailsStatisticPage = () => {
  const satisfactionData = [
    { name: "Có", value: 70 },
    { name: "Không", value: 30 },
  ];

  const channelData = [
    { name: "Mạng xã hội", value: 50 },
    { name: "Bạn bè/giới thiệu", value: 30 },
    { name: "Quảng cáo", value: 10 },
    { name: "Khác", value: 10 },
  ];

  const featureData = [
    { name: "Thanh toán online", value: 100 },
    { name: "Theo dõi đơn hàng", value: 80 },
    { name: "Chương trình khuyến mãi", value: 125 },
    { name: "Hỗ trợ trực tuyến", value: 87 },
    { name: "Đánh giá sản phẩm", value: 38 },
  ];

  const sentimentData = [
    { name: "Tích cực", value: 45 },
    { name: "Trung tính", value: 35 },
    { name: "Tiêu cực", value: 25 },
  ];

  const npsData = [
    { name: "Không giới thiệu", value: 8 },
    { name: "Trung lập", value: 50 },
    { name: "Sẽ giới thiệu", value: 42 },
  ];

  return (
    <MainLayout>
      <div className="details-container">
        <h1 className="page-title">Thống kê phản hồi trắc nghiệm</h1>
        <p className="page-subtitle">
          Biểu đồ thống kê từ các lựa chọn của người tham gia khảo sát
        </p>

        {/* Question 1 */}
        <div className="stat-card">
          <h3>Câu 1: Bạn hài lòng với dịch vụ không?</h3>
          <div className="bar-box">
            {satisfactionData.map((d, idx) => (
              <div key={idx} className="bar-item">
                <div className={`dot ${idx === 0 ? "green" : "red"}`}></div>
                <span className="label">{d.name}</span>
                <div className="bar-line">
                  <div
                    className={`bar-fill ${idx === 0 ? "green" : "red"}`}
                    style={{ width: `${d.value}%` }}
                  ></div>
                </div>
                <span className="percent">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Question 2: Rating */}
        <div className="stat-card">
          <h3>Câu 2: Đánh giá chất lượng dịch vụ (1-5 sao)</h3>
          <div className="rating-box">
            {[1, 2, 3, 4, 5].map((r, i) => (
              <div key={i} className="rating-item">
                <p className={`star-label star-${r}`}>⭐ {r} sao</p>
                <span className="rating-percent">
                  {25 - Math.abs(3 - r) * 7}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Question 3 */}
        <div className="stat-card">
          <h3>Câu 3: Bạn biết đến dịch vụ qua kênh nào?</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={channelData} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" hide />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 4, 4]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Question 4 */}
        <div className="stat-card">
          <h3>Câu 4: Độ tuổi của bạn</h3>
          <div className="age-row">
            <div className="age-box">18–25<br /><span>25 người (27%)</span></div>
            <div className="age-box">26–35<br /><span>30 người (33%)</span></div>
            <div className="age-box">36–45<br /><span>25 người (27%)</span></div>
            <div className="age-box">46+<br /><span>5 người (5%)</span></div>
          </div>
        </div>

        {/* Question 5 */}
        <div className="stat-card">
          <h3>Câu 5: Giới tính</h3>
          <div className="bar-box">
            <div className="bar-item">
              <div className="dot pink"></div>
              <span className="label">Nữ</span>
              <div className="bar-line">
                <div className="bar-fill pink" style={{ width: "58%" }}></div>
              </div>
              <span className="percent">58%</span>
            </div>
            <div className="bar-item">
              <div className="dot blue"></div>
              <span className="label">Nam</span>
              <div className="bar-line">
                <div className="bar-fill blue" style={{ width: "42%" }}></div>
              </div>
              <span className="percent">42%</span>
            </div>
          </div>
        </div>

        {/* Question 7 */}
        <div className="stat-card">
          <h3>Câu 7: Bạn quan tâm đến những tính năng nào?</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={featureData} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" hide />
              <Tooltip />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 4, 4]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Question 9: Sentiment */}
        <div className="stat-card">
          <h3>Câu 9: Phân tích cảm xúc phản hồi</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={sentimentData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={70}
                label
              >
                {sentimentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Question 10: NPS */}
        <div className="stat-card">
          <h3>Câu 10: Bạn có khuyến nghị dịch vụ cho người khác không?</h3>
          <div className="nps-box">
            <div className="nps-score">+42</div>
            <p className="nps-label">NPS Score</p>
            <div className="nps-stats">
              <p>Không giới thiệu: 8%</p>
              <p>Trung lập: 50%</p>
              <p>Sẽ giới thiệu: 42%</p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default DetailsStatisticPage;
