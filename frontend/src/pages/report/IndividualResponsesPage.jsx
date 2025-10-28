import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import './IndividualResponses.css';

const IndividualResponsesPage = () => {
    const location = useLocation();
    const [selectedResponses, setSelectedResponses] = useState(new Set());
    const [responses, setResponses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [totalCount, setTotalCount] = useState(247);
    const [displayedCount, setDisplayedCount] = useState(8);

    // Mock data matching the design
    const mockResponses = [
        {
            id: 1,
            time: '16:15 15/01/2024',
            overallRating: 'Xuất sắc',
            concerns: ['Chất lượng sản phẩm', 'Hỗ trợ khách hàng'],
            feedback: 'Dịch vụ rất tốt, nhân viên nhiệt tình. T...',
            npsScore: 9,
            npsMax: 10
        },
        {
            id: 2,
            time: '17:32 15/01/2024',
            overallRating: 'Tốt',
            concerns: ['Giá cả hợp lý', 'Tốc độ giao hàng'],
            feedback: 'Sản phẩm chất lượng, giá cả phải chả...',
            npsScore: 7,
            npsMax: 10
        },
        {
            id: 3,
            time: '18:45 15/01/2024',
            overallRating: 'Trung bình',
            concerns: ['Sự tiến lợi'],
            feedback: 'Dịch vụ ổn nhưng chưa thực sự nổi bật...',
            npsScore: 5,
            npsMax: 10
        },
        {
            id: 4,
            time: '21:20 15/01/2024',
            overallRating: 'Xuất sắc',
            concerns: ['Chất lượng sản phẩm', 'Hỗ trợ khách hàng', 'Tốc độ giao hàng'],
            feedback: 'Tôi rất hài lòng với dịch vụ. Sản phẩm ...',
            npsScore: 10,
            npsMax: 10
        },
        {
            id: 5,
            time: '22:55 15/01/2024',
            overallRating: 'Tốt',
            concerns: ['Giá cả hợp lý', 'Sự tiến lợi'],
            feedback: 'Giá cả hợp lý, dễ đặt hàng. Tuy nhiên...',
            npsScore: 8,
            npsMax: 10
        },
        {
            id: 6,
            time: '23:20 15/01/2024',
            overallRating: 'Kém',
            concerns: ['Giá cả hợp lý'],
            feedback: 'Dịch vụ chưa đáp ứng được kỳ vọng...',
            npsScore: 3,
            npsMax: 10
        },
        {
            id: 7,
            time: '00:10 16/01/2024',
            overallRating: 'Xuất sắc',
            concerns: ['Chất lượng sản phẩm', 'Sự tiến lợi'],
            feedback: 'Rất hài lòng với trải nghiệm. Sản phẩm...',
            npsScore: 9,
            npsMax: 10
        },
        {
            id: 8,
            time: '01:30 16/01/2024',
            overallRating: 'Tốt',
            concerns: ['Hỗ trợ khách hàng', 'Tốc độ giao hàng'],
            feedback: 'Nhân viên hỗ trợ rất tận tình, giao hàng...',
            npsScore: 8,
            npsMax: 10
        }
    ];

    useEffect(() => {
        setResponses(mockResponses);
    }, []);

    const handleSelectAll = (checked) => {
        if (checked) {
            setSelectedResponses(new Set(responses.map(r => r.id)));
        } else {
            setSelectedResponses(new Set());
        }
    };

    const handleSelectResponse = (id, checked) => {
        const newSelected = new Set(selectedResponses);
        if (checked) {
            newSelected.add(id);
        } else {
            newSelected.delete(id);
        }
        setSelectedResponses(newSelected);
    };

    const getRatingClass = (rating) => {
        const classes = {
            'Xuất sắc': 'rating-excellent',
            'Tốt': 'rating-good',
            'Trung bình': 'rating-average',
            'Kém': 'rating-poor'
        };
        return classes[rating] || 'rating-default';
    };

    const getConcernClass = (concern) => {
        const classes = {
            'Chất lượng sản phẩm': 'concern-quality',
            'Hỗ trợ khách hàng': 'concern-support',
            'Giá cả hợp lý': 'concern-price',
            'Tốc độ giao hàng': 'concern-delivery',
            'Sự tiện lợi': 'concern-convenience'
        };
        return classes[concern] || 'concern-default';
    };

    const getNPSClass = (score) => {
        if (score >= 9) return 'nps-promoter';
        if (score >= 7) return 'nps-passive';
        return 'nps-detractor';
    };

    const handleLoadMore = () => {
        setDisplayedCount(prev => Math.min(prev + 8, totalCount));
    };

    const handleViewAll = () => {
        setDisplayedCount(totalCount);
    };

    return (
        <MainLayout>
            <div className="individual-responses-container">
                {/* Header */}
                <div className="page-header">
                    <div className="header-content">
                        <h1 className="page-title">Khảo sát độ hài lòng dịch vụ khách hàng</h1>
                        <p className="page-subtitle">Xem tất cả phản hồi dưới dạng bảng dữ liệu</p>
                    </div>
                    <div className="total-count">
                        <span className="count-number">{totalCount}</span>
                        <span className="count-label">Tổng phản hồi</span>
                    </div>
                </div>

                {/* Responses Table */}
                <div className="responses-table-container">
                    <table className="responses-table">
                        <thead>
                            <tr>
                                <th className="checkbox-column">
                                    <input
                                        type="checkbox"
                                        checked={selectedResponses.size === responses.length && responses.length > 0}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                    />
                                </th>
                                <th className="time-column">Thời gian gửi</th>
                                <th className="rating-column">Đánh giá chất lượng dịch vụ vui tổng thể</th>
                                <th className="concerns-column">Yếu tố quan tâm nhất</th>
                                <th className="feedback-column">Góp ý cải thiện dịch vụ</th>
                                <th className="nps-column">Khả năng giới thiệu (NPS)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {responses.slice(0, displayedCount).map((response, index) => (
                                <tr key={response.id} className="response-row">
                                    <td className="checkbox-cell">
                                        <input
                                            type="checkbox"
                                            checked={selectedResponses.has(response.id)}
                                            onChange={(e) => handleSelectResponse(response.id, e.target.checked)}
                                        />
                                    </td>
                                    <td className="time-cell">
                                        <div className="response-number">#{index + 1}</div>
                                        <div className="response-time">{response.time}</div>
                                    </td>
                                    <td className="rating-cell">
                                        <span className={`rating-tag ${getRatingClass(response.overallRating)}`}>
                                            {response.overallRating}
                                        </span>
                                    </td>
                                    <td className="concerns-cell">
                                        <div className="concerns-tags">
                                            {response.concerns.map((concern, idx) => (
                                                <span
                                                    key={idx}
                                                    className={`concern-tag ${getConcernClass(concern)}`}
                                                >
                                                    {concern}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="feedback-cell">
                                        <div className="feedback-text">{response.feedback}</div>
                                    </td>
                                    <td className="nps-cell">
                                        <span className={`nps-score ${getNPSClass(response.npsScore)}`}>
                                            {response.npsScore}/{response.npsMax}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer Actions */}
                <div className="table-footer">
                    <div className="display-info">
                        Hiển thị <strong>{displayedCount}</strong> phản hồi
                    </div>
                    <div className="footer-actions">
                        {displayedCount < totalCount && (
                            <>
                                <button className="load-more-btn" onClick={handleLoadMore}>
                                    Tải thêm
                                </button>
                                <button className="view-all-btn" onClick={handleViewAll}>
                                    Xem tất cả
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </MainLayout>
    );
};

export default IndividualResponsesPage;
