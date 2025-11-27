import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import { individualResponseService } from '../../services/individualResponseService';
import { surveyService } from '../../services/surveyService';
import { questionService, optionService } from '../../services/questionSurvey';
import ToolbarResult from '../../components/ToolbarResult';
import AIChat, { AIChatButton } from '../../components/AIChat';
import './IndividualResponses.css';

const IndividualResponsesPage = () => {
    const location = useLocation();
    const [showAIChat, setShowAIChat] = useState(false);

    // Lấy surveyId từ location.state
    const surveyData = location.state || {};
    const { surveyId, surveyTitle, surveyDescription } = surveyData;

    const [selectedResponses, setSelectedResponses] = useState(new Set());
    const [responses, setResponses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize] = useState(10);
    const [surveyInfo, setSurveyInfo] = useState(null);
    const [questionsMap, setQuestionsMap] = useState(new Map()); // Map questionId -> question data

    // Filter states
    const [filters, setFilters] = useState({
        search: '',
        completionStatus: '',
        from: '',
        to: ''
    });
    const [searchDraft, setSearchDraft] = useState('');

    const [loadingFiles, setLoadingFiles] = useState(new Set());

    // File handling functions
    const handleFileView = async (file) => {
        const fileKey = `view_${file.fileId}`;
        setLoadingFiles(prev => new Set(prev).add(fileKey));

        try {
            const response = await individualResponseService.viewFile(file.fileId);
            // Open in new tab
            const blob = new Blob([response], { type: file.fileType });
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (error) {
            console.error('Error viewing file:', error);
            alert('Không thể xem file. Vui lòng thử lại.');
        } finally {
            setLoadingFiles(prev => {
                const newSet = new Set(prev);
                newSet.delete(fileKey);
                return newSet;
            });
        }
    };

    const handleFileDownload = async (file) => {
        const fileKey = `download_${file.fileId}`;
        setLoadingFiles(prev => new Set(prev).add(fileKey));

        try {
            const response = await individualResponseService.downloadFile(file.fileId, file.originalFileName);
            // Trigger download
            const blob = new Blob([response], { type: file.fileType });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.originalFileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading file:', error);
            alert('Không thể tải file. Vui lòng thử lại.');
        } finally {
            setLoadingFiles(prev => {
                const newSet = new Set(prev);
                newSet.delete(fileKey);
                return newSet;
            });
        }
    };

    // Format thời gian từ ISO string
    const formatDateTime = (dateTimeString) => {
        if (!dateTimeString) return '';
        try {
            const date = new Date(dateTimeString);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${hours}:${minutes} ${day}/${month}/${year}`;
        } catch (error) {
            return dateTimeString;
        }
    };

    // Format câu trả lời dựa trên loại câu hỏi
    const formatAnswer = (answer, questionData) => {
        if (!answer) return 'Chưa trả lời';

        // Single choice hoặc boolean
        if (answer.selectedOptionId || answer.optionId) {
            const optionId = answer.selectedOptionId || answer.optionId;
            if (questionData?.options) {
                const option = questionData.options.find(opt => opt.id === optionId || opt.optionId === optionId);
                return option?.optionText || option?.option_text || `Option ${optionId}`;
            }
            return `Option ${optionId}`;
        }

        // Multiple choice
        if (answer.selectedOptionIds && answer.selectedOptionIds.length > 0) {
            if (questionData?.options) {
                const selectedOptions = answer.selectedOptionIds
                    .map(optId => {
                        const opt = questionData.options.find(o => o.id === optId || o.optionId === optId);
                        return opt?.optionText || opt?.option_text || `Option ${optId}`;
                    })
                    .filter(Boolean);
                return selectedOptions.join(', ');
            }
            return answer.selectedOptionIds.join(', ');
        }

        // Ranking
        if (answer.rankingOptionIds && answer.rankingOptionIds.length > 0) {
            if (questionData?.options) {
                const rankedOptions = answer.rankingOptionIds
                    .map((optId, index) => {
                        const opt = questionData.options.find(o => o.id === optId || o.optionId === optId);
                        return `${index + 1}. ${opt?.optionText || opt?.option_text || `Option ${optId}`}`;
                    })
                    .filter(Boolean);
                return rankedOptions.join(' | ');
            }
            return answer.rankingOptionIds.map((id, idx) => `${idx + 1}. Option ${id}`).join(' | ');
        }

        // Date/Time
        if (answer.dateValue || answer.timeValue) {
            const parts = [];
            if (answer.dateValue) parts.push(answer.dateValue);
            if (answer.timeValue) parts.push(answer.timeValue);
            return parts.join(' ');
        }

        // File upload - CHECK THIS FIRST before answerText
        if (answer.uploadedFiles && answer.uploadedFiles.length > 0) {
            console.log('📎 Found uploadedFiles:', answer.uploadedFiles);
            return {
                type: 'files',
                files: answer.uploadedFiles
            };
        }

        // Text answer (open-ended, rating) - but skip "File uploaded successfully" messages
        if (answer.answerText && !answer.answerText.startsWith('File uploaded successfully')) {
            return answer.answerText.length > 100
                ? answer.answerText.substring(0, 100) + '...'
                : answer.answerText;
        }

        return 'Chưa trả lời';
    };

    // Reset khi surveyId thay đổi
    useEffect(() => {
        if (surveyId) {
            setCurrentPage(0);
            setResponses([]);
            setTotalCount(0);
            setError(null);
            setFilters({
                search: '',
                completionStatus: '',
                from: '',
                to: ''
            });
            setSearchDraft('');
        }
    }, [surveyId]);

    // Reset page khi filter thay đổi
    useEffect(() => {
        setCurrentPage(0);
        setResponses([]);
    }, [filters.search, filters.completionStatus, filters.from, filters.to]);

    // Load survey info và questions
    useEffect(() => {
        const loadSurveyInfo = async () => {
            if (!surveyId) return;

            try {
                // Load survey
                const survey = await surveyService.getSurveyById(surveyId);
                setSurveyInfo({
                    id: survey.id || survey.surveyId,
                    title: survey.title || surveyTitle || 'Khảo sát',
                    description: survey.description || surveyDescription || ''
                });

                // Load questions
                const questions = await questionService.getQuestionsBySurvey(surveyId);
                const map = new Map();

                for (const q of questions) {
                    let options = [];
                    if (q.questionType === 'multiple_choice' || q.questionType === 'single_choice' ||
                        q.questionType === 'boolean_' || q.questionType === 'boolean' ||
                        q.questionType === 'ranking') {
                        try {
                            options = await optionService.getOptionsByQuestion(q.id);
                        } catch (err) {
                            console.log('No options found for question:', q.id);
                            options = q.options || [];
                        }
                    }

                    map.set(q.id, {
                        id: q.id,
                        questionText: q.questionText || q.question_text,
                        questionType: q.questionType || q.question_type,
                        options: options
                    });
                }

                setQuestionsMap(map);
            } catch (error) {
                console.error('Error loading survey info:', error);
                setError('Không thể tải thông tin khảo sát');
            }
        };

        loadSurveyInfo();
    }, [surveyId, surveyTitle, surveyDescription]);

    // Load responses từ API
    useEffect(() => {
        const loadResponses = async () => {
            if (!surveyId) return;

            setLoading(true);
            setError(null);

            try {
                // Chuẩn bị filter object cho API
                const filterParams = {
                    page: currentPage,
                    size: pageSize,
                    sort: 'submittedAt,desc'
                };

                // Thêm các filter nếu có giá trị
                if (filters.search.trim()) {
                    filterParams.search = filters.search.trim();
                }
                if (filters.completionStatus) {
                    filterParams.completionStatus = filters.completionStatus;
                }
                if (filters.from) {
                    filterParams.from = filters.from;
                }
                if (filters.to) {
                    filterParams.to = filters.to;
                }

                // Gọi API listResponses để lấy danh sách summary
                const responseData = await individualResponseService.listResponses(surveyId, filterParams);

                // Cập nhật total count
                if (responseData.meta) {
                    setTotalCount(responseData.meta.total || 0);
                }

                // Lấy danh sách response summaries
                const summaries = responseData.result || [];

                // Load chi tiết cho từng response để có answers
                const responsesWithDetails = await Promise.all(
                    summaries.map(async (summary) => {
                        try {
                            const detail = await individualResponseService.getResponseDetail(summary.responseId);
                            return {
                                ...summary,
                                answers: detail.answers || [],
                                detail: detail
                            };
                        } catch (error) {
                            console.error(`Error loading detail for response ${summary.responseId}:`, error);
                            return {
                                ...summary,
                                answers: [],
                                detail: null
                            };
                        }
                    })
                );

                // Append nếu không phải page đầu tiên, replace nếu là page đầu
                if (currentPage === 0) {
                    setResponses(responsesWithDetails);
                } else {
                    setResponses(prev => [...prev, ...responsesWithDetails]);
                }
            } catch (error) {
                console.error('Error loading responses:', error);
                setError('Không thể tải danh sách phản hồi: ' + (error.response?.data?.message || error.message));
            } finally {
                setLoading(false);
            }
        };

        loadResponses();
    }, [surveyId, currentPage, pageSize, filters]);

    const handleSelectAll = (checked) => {
        if (checked) {
            setSelectedResponses(new Set(responses.map(r => r.responseId)));
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
        if (currentPage * pageSize + responses.length < totalCount) {
            setCurrentPage(prev => prev + 1);
        }
    };

    const handleViewAll = () => {
        // Load tất cả bằng cách tăng page size
        // Hoặc có thể implement infinite scroll
    };

    // Chuyển questionsMap thành array để sắp xếp và hiển thị
    const questionsList = useMemo(() => {
        return Array.from(questionsMap.values()).sort((a, b) => a.id - b.id);
    }, [questionsMap]);

    // Lấy answer cho một question cụ thể trong response
    const getAnswerForQuestion = (response, questionId) => {
        if (!response.answers || response.answers.length === 0) {
            return null;
        }
        return response.answers.find(answer => answer.questionId === questionId) || null;
    };

    // Xử lý thay đổi filter
    const handleFilterChange = (filterName, value) => {
        setFilters(prev => ({
            ...prev,
            [filterName]: value
        }));
    };

    // Reset tất cả filters
    const handleResetFilters = () => {
        setFilters({
            search: '',
            completionStatus: '',
            from: '',
            to: ''
        });
        setSearchDraft('');
    };

    // Debounce live search: only apply when >= 3 characters, or clear when empty
    useEffect(() => {
        const t = setTimeout(() => {
            const v = searchDraft.trim();
            if (v === '') {
                handleFilterChange('search', '');
            } else if (v.length >= 1) {
                handleFilterChange('search', v);
            }
        }, 800);

        return () => clearTimeout(t);
    }, [searchDraft]);

    // Format date để input date-time-local
    const formatDateForInput = (dateString) => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            // Format: YYYY-MM-DDTHH:mm
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch (error) {
            return '';
        }
    };

    // Tính số response đang hiển thị
    const displayedCount = useMemo(() => {
        return Math.min(currentPage * pageSize + responses.length, totalCount);
    }, [currentPage, pageSize, responses.length, totalCount]);

    if (!surveyId) {
        return (
            <MainLayout surveyId={null}>
                <ToolbarResult
                    surveyId={surveyId}
                    surveyTitle={surveyTitle}
                    surveyDescription={surveyDescription}
                />
                <div className="individual-responses-container">
                    <div style={{ padding: '20px', textAlign: 'center' }}>
                        <p>Vui lòng chọn khảo sát để xem phản hồi.</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    if (loading && responses.length === 0) {
        return (
            <MainLayout
                surveyId={surveyId}
                surveyTitle={surveyTitle}
                surveyDescription={surveyDescription}
            >
                <ToolbarResult
                    surveyId={surveyId}
                    surveyTitle={surveyTitle}
                    surveyDescription={surveyDescription}
                />
                <div className="individual-responses-container">
                    <div style={{ padding: '20px', textAlign: 'center' }}>
                        <p>Đang tải dữ liệu...</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    if (error && responses.length === 0) {
        return (
            <MainLayout
                surveyId={surveyId}
                surveyTitle={surveyTitle}
                surveyDescription={surveyDescription}
            >
                <ToolbarResult
                    surveyId={surveyId}
                    surveyTitle={surveyTitle}
                    surveyDescription={surveyDescription}
                />
                <div className="individual-responses-container">
                    <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
                        <p>{error}</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout
            surveyId={surveyId}
            surveyTitle={surveyInfo?.title || surveyTitle}
            surveyDescription={surveyInfo?.description || surveyDescription}
        >
            <div className="individual-responses-container">
                <ToolbarResult
                    surveyId={surveyId}
                    surveyTitle={surveyInfo?.title || surveyTitle}
                    surveyDescription={surveyInfo?.description || surveyDescription}
                />
                {/* Header */}
                <div className="page-header">
                    <div className="header-content">
                        <h1 className="page-title">{surveyInfo?.title || surveyTitle || 'Danh sách phản hồi'}</h1>
                        <p className="page-subtitle">Xem tất cả phản hồi dưới dạng bảng dữ liệu</p>
                    </div>
                    <div className="total-count">
                        <span className="count-number">{totalCount}</span>
                        <span className="count-label">Tổng phản hồi</span>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="filter-bar">
                    <div className="filter-bar-content">
                        <div className="filter-group">
                            <label htmlFor="filter-search" className="filter-label">Tìm kiếm</label>
                            <input
                                id="filter-search"
                                type="text"
                                className="filter-input"
                                placeholder="Tìm trong câu trả lời..."
                                value={searchDraft}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setSearchDraft(v);
                                    if (v.trim() === '') {
                                        handleFilterChange('search', '');
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const v = searchDraft.trim();
                                        if (v === '' || v.length >= 3) {
                                            handleFilterChange('search', v);
                                        }
                                    }
                                }}
                            />
                        </div>

                        <div className="filter-group">
                            <label htmlFor="filter-status" className="filter-label">Trạng thái</label>
                            <select
                                id="filter-status"
                                className="filter-select"
                                value={filters.completionStatus}
                                onChange={(e) => handleFilterChange('completionStatus', e.target.value)}
                            >
                                <option value="">Tất cả</option>
                                <option value="completed">Hoàn thành</option>
                                <option value="partial">Một phần</option>
                                <option value="dropped">Chưa hoàn thành</option>
                            </select>
                        </div>

                        <div className="filter-group">
                            <label htmlFor="filter-from" className="filter-label">Từ ngày</label>
                            <input
                                id="filter-from"
                                type="datetime-local"
                                className="filter-input"
                                value={filters.from}
                                onChange={(e) => handleFilterChange('from', e.target.value)}
                            />
                        </div>

                        <div className="filter-group">
                            <label htmlFor="filter-to" className="filter-label">Đến ngày</label>
                            <input
                                id="filter-to"
                                type="datetime-local"
                                className="filter-input"
                                value={filters.to}
                                onChange={(e) => handleFilterChange('to', e.target.value)}
                            />
                        </div>

                        <div className="filter-actions">
                            <button
                                className="filter-reset-btn"
                                onClick={handleResetFilters}
                                disabled={!filters.search && !filters.completionStatus && !filters.from && !filters.to}
                            >
                                Reset
                            </button>
                        </div>
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
                                <th className="rating-column">Trạng thái</th>
                                {/* Dynamic headers cho từng câu hỏi */}
                                {questionsList.map((question) => (
                                    <th key={question.id} className="question-column" title={question.questionText}>
                                        <div className="question-header">
                                            {question.questionText || `Câu hỏi ${question.id}`}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {responses.length === 0 ? (
                                <tr>
                                    <td colSpan={3 + questionsList.length} style={{ textAlign: 'center', padding: '40px' }}>
                                        {questionsList.length === 0 ? 'Đang tải câu hỏi...' : 'Chưa có phản hồi nào'}
                                    </td>
                                </tr>
                            ) : (
                                responses.map((response, index) => {
                                    return (
                                        <tr key={response.responseId} className="response-row">
                                            <td className="checkbox-cell">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedResponses.has(response.responseId)}
                                                    onChange={(e) => handleSelectResponse(response.responseId, e.target.checked)}
                                                />
                                            </td>
                                            <td className="time-cell">
                                                <div className="response-number">#{currentPage * pageSize + index + 1}</div>
                                                <div className="response-time">
                                                    {formatDateTime(response.submittedAt)}
                                                </div>
                                            </td>
                                            <td className="rating-cell">
                                                <span className={`rating-tag ${response.completionStatus === 'completed' ? 'rating-excellent' :
                                                    response.completionStatus === 'partial' ? 'rating-average' :
                                                        'rating-poor'
                                                    }`}>
                                                    {response.completionStatus === 'completed' ? 'Hoàn thành' :
                                                        response.completionStatus === 'partial' ? 'Một phần' :
                                                            'Chưa hoàn thành'}
                                                </span>
                                            </td>
                                            {/* Dynamic cells cho từng câu hỏi */}
                                            {questionsList.map((question) => {
                                                const answer = getAnswerForQuestion(response, question.id);
                                                const questionData = questionsMap.get(question.id);
                                                const answerFormatted = answer ? formatAnswer(answer, questionData) : 'Chưa trả lời';

                                                return (
                                                    <td key={question.id} className="answer-cell">
                                                        {answerFormatted?.type === 'files' ? (
                                                            <div className="file-list">
                                                                {answerFormatted.files.map((file, fileIndex) => (
                                                                    <div key={fileIndex} className="file-item">
                                                                        <div className="file-info">
                                                                            <span
                                                                                className="file-name"
                                                                                data-file-type={file.fileType}
                                                                                title={file.originalFileName || file.fileName}
                                                                            >
                                                                                {file.originalFileName || file.fileName}
                                                                            </span>
                                                                            <span className="file-size">
                                                                                {file.fileSize ? `${(file.fileSize / 1024).toFixed(1)} KB` : ''}
                                                                            </span>
                                                                        </div>
                                                                        <div className="file-actions">
                                                                            <button
                                                                                onClick={() => handleFileView(file)}
                                                                                className={`file-action-btn view-btn ${loadingFiles.has(`view_${file.fileId}`) ? 'loading' : ''}`}
                                                                                title="Xem file"
                                                                                disabled={loadingFiles.has(`view_${file.fileId}`)}
                                                                            >
                                                                                {loadingFiles.has(`view_${file.fileId}`) ? (
                                                                                    <svg className="loading-spinner" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="60" strokeDashoffset="60">
                                                                                            <animate attributeName="stroke-dashoffset" values="60;0;60" dur="1.5s" repeatCount="indefinite" />
                                                                                        </circle>
                                                                                    </svg>
                                                                                ) : (
                                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                                                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                                                                                    </svg>
                                                                                )}
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleFileDownload(file)}
                                                                                className={`file-action-btn download-btn ${loadingFiles.has(`download_${file.fileId}`) ? 'loading' : ''}`}
                                                                                title="Tải xuống"
                                                                                disabled={loadingFiles.has(`download_${file.fileId}`)}
                                                                            >
                                                                                {loadingFiles.has(`download_${file.fileId}`) ? (
                                                                                    <svg className="loading-spinner" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="60" strokeDashoffset="60">
                                                                                            <animate attributeName="stroke-dashoffset" values="60;0;60" dur="1.5s" repeatCount="indefinite" />
                                                                                        </circle>
                                                                                    </svg>
                                                                                ) : (
                                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                                                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                                                                                    </svg>
                                                                                )}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="answer-text" title={typeof answerFormatted === 'string' ? answerFormatted : JSON.stringify(answerFormatted)}>
                                                                {typeof answerFormatted === 'string' ? answerFormatted : JSON.stringify(answerFormatted)}
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Actions */}
                <div className="table-footer">
                    <div className="display-info">
                        Hiển thị <strong>{displayedCount}</strong> / <strong>{totalCount}</strong> phản hồi
                        {loading && <span style={{ marginLeft: '10px' }}>Đang tải...</span>}
                    </div>
                    <div className="footer-actions">
                        {displayedCount < totalCount && (
                            <button
                                className="load-more-btn"
                                onClick={handleLoadMore}
                                disabled={loading}
                            >
                                {loading ? 'Đang tải...' : 'Tải thêm'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* AI Chat Button - Hiển thị khi có surveyId */}
            {surveyId && (
                <>
                    {!showAIChat && (
                        <AIChatButton
                            onClick={() => setShowAIChat(true)}
                            surveyId={surveyId}
                        />
                    )}
                    {showAIChat && (
                        <AIChat
                            surveyId={surveyId}
                            surveyTitle={surveyTitle}
                            surveyDescription={surveyDescription}
                            onClose={() => setShowAIChat(false)}
                            isOpen={showAIChat}
                        />
                    )}
                </>
            )}
        </MainLayout>
    );
};

export default IndividualResponsesPage;
