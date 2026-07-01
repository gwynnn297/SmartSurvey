import React, { useState, useEffect, useRef } from 'react';
import { aiChatService } from '../services/aiChatService';
import './AIChat.css';

const AIChat = ({ surveyId, surveyTitle, surveyDescription, onClose, isOpen: externalIsOpen = true }) => {
    const [isOpen, setIsOpen] = useState(externalIsOpen);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [summary, setSummary] = useState('');
    const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
    const [chatHistory, setChatHistory] = useState([]);
    const [error, setError] = useState(null);
    const [showMenu, setShowMenu] = useState(false);
    const [isIngesting, setIsIngesting] = useState(false);
    const [ingestionStatus, setIngestionStatus] = useState('');
    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);
    const menuRef = useRef(null);
    const ingestionDoneRef = useRef(false);

    // Hàm làm sạch response text để loại bỏ phần lặp lại và thừa
    const cleanResponseText = (text) => {
        if (!text || typeof text !== 'string') return text;

        let cleaned = text.trim();

        // Loại bỏ các đoạn text không cần thiết
        cleaned = cleaned.replace(/hãy sửa bỏ những phần thừa khi trả lời chatbot/gi, '').trim();

        // Pattern để nhận diện phần kết thúc
        const endingPattern = /Tóm lại.*?phản hồi.*?trên\.?/gi;

        // Bước 1: Loại bỏ các ending pattern bị lặp lại (chỉ giữ lại lần đầu tiên)
        const endingMatches = [...cleaned.matchAll(new RegExp(endingPattern.source, 'gi'))];
        if (endingMatches.length > 1) {
            // Xóa tất cả các ending pattern trừ lần đầu tiên
            let lastIndex = 0;
            for (let i = 1; i < endingMatches.length; i++) {
                const match = endingMatches[i];
                cleaned = cleaned.substring(0, match.index) + cleaned.substring(match.index + match[0].length);
                // Cập nhật lại indices cho các matches sau
                for (let j = i + 1; j < endingMatches.length; j++) {
                    endingMatches[j].index -= match[0].length;
                }
            }
        }

        // Bước 2: Loại bỏ các bullet points bị duplicate trong cùng một section
        const lines = cleaned.split('\n');
        const result = [];
        const seenBullets = new Set();

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) {
                // Khi gặp dòng trống, reset seenBullets để bắt đầu section mới
                if (result.length > 0 && result[result.length - 1] !== '') {
                    seenBullets.clear();
                    result.push('');
                }
                continue;
            }

            const isBullet = /^[-•*]\s+/.test(line);
            const isEnding = endingPattern.test(line);

            if (isBullet) {
                const bulletContent = line.replace(/^[-•*]\s+/, '').trim().toLowerCase();
                if (!seenBullets.has(bulletContent)) {
                    seenBullets.add(bulletContent);
                    result.push(line);
                }
            } else if (isEnding) {
                // Khi gặp ending pattern, reset và thêm ending (đã được xử lý ở bước 1 nên chỉ có 1 lần)
                seenBullets.clear();
                result.push(line);
            } else {
                // Dòng text thường - reset seenBullets khi có text không phải bullet
                seenBullets.clear();
                result.push(line);
            }
        }

        cleaned = result.filter((line, idx) => {
            // Loại bỏ các dòng trống liên tiếp
            if (!line && idx > 0 && result[idx - 1] === '') return false;
            return true;
        }).join('\n').trim();

        // Bước 3: Loại bỏ các đoạn text bị lặp lại hoàn toàn (tìm và xóa duplicate sections)
        // Tìm các đoạn text từ 30 ký tự trở lên bị lặp lại
        const minDupLength = 30;
        let foundDuplicate = true;

        while (foundDuplicate) {
            foundDuplicate = false;
            for (let len = Math.min(cleaned.length / 2, 200); len >= minDupLength && !foundDuplicate; len -= 5) {
                for (let start = 0; start <= cleaned.length - len * 2 && !foundDuplicate; start += 5) {
                    const section = cleaned.substring(start, start + len);
                    const normalizedSection = section.toLowerCase().replace(/\s+/g, ' ').trim();

                    if (normalizedSection.length < minDupLength) continue;

                    // Tìm lần xuất hiện tiếp theo của section này
                    const nextIndex = cleaned.toLowerCase().indexOf(normalizedSection, start + len);
                    if (nextIndex !== -1 && nextIndex > start + len) {
                        // Tìm thấy duplicate, loại bỏ lần xuất hiện thứ 2
                        const actualSection = cleaned.substring(nextIndex, nextIndex + section.length);
                        cleaned = cleaned.substring(0, nextIndex) + cleaned.substring(nextIndex + actualSection.length);
                        foundDuplicate = true;
                        break;
                    }
                }
            }
        }

        // Loại bỏ khoảng trắng và dòng trống thừa
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();

        return cleaned;
    };

    // Ingest survey data vào RAG khi mở chat lần đầu
    const ingestSurveyData = async () => {
        if (!surveyId || ingestionDoneRef.current) return;

        try {
            setIsIngesting(true);
            setIngestionStatus('Đang chuẩn bị dữ liệu...');
            console.log('Starting RAG ingest for survey:', surveyId);

            const response = await aiChatService.ingestSurveyData(surveyId);
            console.log('RAG ingest completed:', response);

            setIngestionStatus('Dữ liệu đã sẵn sàng!');
            ingestionDoneRef.current = true;

            // Clear status after 2 seconds
            setTimeout(() => {
                setIngestionStatus('');
            }, 2000);
        } catch (error) {
            console.error('Error ingesting survey data:', error);
            // Don't show error for ingest, just log it
            // The chat can still work without ingest
            ingestionDoneRef.current = true;
        } finally {
            setIsIngesting(false);
        }
    };

    // Load chat history khi mở chat
    useEffect(() => {
        if (isOpen && surveyId) {
            ingestSurveyData();
            loadChatHistory();
            generateSummary();
        }
    }, [isOpen, surveyId]);

    // Auto scroll to bottom khi có tin nhắn mới
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadChatHistory = async (updateMessages = true) => {
        try {
            const response = await aiChatService.getChatHistory(surveyId, 20);
            if (response && response.chat_history) {
                console.log('[AIChat] Chat history loaded:', response.chat_history);

                // Loại bỏ duplicates dựa trên chat_id
                const uniqueHistory = response.chat_history.filter((item, index, self) =>
                    index === self.findIndex(t => (t.chat_id || t.chatId) === (item.chat_id || item.chatId))
                );
                console.log('[AIChat] Unique chat history:', uniqueHistory);

                // Cập nhật chatHistory cho sidebar
                setChatHistory(uniqueHistory);

                // Chỉ format và update messages khi cần (lần đầu load hoặc reset)
                if (updateMessages) {
                    const formattedMessages = uniqueHistory
                        .sort((a, b) => new Date(a.createdAt || a.created_at) - new Date(b.createdAt || b.created_at))
                        .flatMap(item => [
                            {
                                id: `q-${item.chatId || item.chat_id}`,
                                type: 'user',
                                text: item.questionText || item.question_text || '',
                                timestamp: item.createdAt || item.created_at
                            },
                            {
                                id: `a-${item.chatId || item.chat_id}`,
                                type: 'ai',
                                text: cleanResponseText(item.aiResponse || item.ai_response || ''),
                                timestamp: item.createdAt || item.created_at
                            }
                        ]);
                    console.log('[AIChat] Formatted messages:', formattedMessages);
                    setMessages(formattedMessages);
                }
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
            setError('Không thể tải lịch sử chat');
        }
    };

    const generateSummary = async () => {
        if (!surveyId || summary) return;

        try {
            // Tạo prompt để tạo summary
            const summaryPrompt = `Tóm tắt khảo sát "${surveyTitle || 'khảo sát'}" với mô tả: "${surveyDescription || 'không có mô tả'}". Hãy đưa ra một bản tóm tắt ngắn gọn về nội dung và mục đích của khảo sát này.`;

            // Có thể gọi API để tạo summary hoặc tự tạo summary đơn giản
            if (surveyTitle || surveyDescription) {
                const autoSummary = surveyDescription
                    ? `Khảo sát này có tên "${surveyTitle || 'Khảo sát'}" và ${surveyDescription}`
                    : `Khảo sát "${surveyTitle || 'Khảo sát'}" đang được sử dụng để thu thập thông tin và phản hồi từ người dùng.`;
                setSummary(autoSummary);
            }
        } catch (error) {
            console.error('Error generating summary:', error);
        }
    };

    const handleSendMessage = async () => {
        if (!inputText.trim() || isLoading || !surveyId) return;

        const userMessage = {
            id: `user-${Date.now()}`,
            type: 'user',
            text: inputText.trim(),
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMessage]);
        const inputTextValue = inputText.trim();
        setInputText('');
        setIsLoading(true);
        setError(null);

        try {
            const response = await aiChatService.processChat({
                surveyId: surveyId,
                questionText: inputTextValue,
                topK: 5
            });

            // Làm sạch response text để loại bỏ phần lặp lại và thừa
            const rawAnswerText = response.answer_text || 'Xin lỗi, không thể tạo phản hồi.';
            const cleanedAnswerText = cleanResponseText(rawAnswerText);

            const aiMessage = {
                id: `ai-${Date.now()}`,
                type: 'ai',
                text: cleanedAnswerText,
                timestamp: response.created_at || new Date().toISOString()
            };

            setMessages(prev => [...prev, aiMessage]);

            // Chỉ reload chat history để update sidebar, KHÔNG update messages để tránh duplicate
            try {
                await loadChatHistory(false); // false = không update messages
            } catch (historyError) {
                console.error('Error reloading chat history:', historyError);
                // Không hiển thị lỗi cho user vì tin nhắn đã được gửi thành công
            }
        } catch (error) {
            console.error('Error sending message:', error);
            setError('Không thể gửi tin nhắn. Vui lòng thử lại.');

            const errorMessage = {
                id: `error-${Date.now()}`,
                type: 'ai',
                text: 'Xin lỗi, đã xảy ra lỗi khi xử lý câu hỏi của bạn. Vui lòng thử lại sau.',
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Sync external isOpen state
    useEffect(() => {
        if (externalIsOpen !== undefined) {
            setIsOpen(externalIsOpen);
        }
    }, [externalIsOpen]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false);
            }
        };

        if (showMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showMenu]);

    const handleToggleChat = () => {
        if (onClose) {
            onClose();
        } else {
            setIsOpen(false);
        }
    };

    const handleNewChat = () => {
        setMessages([]);
        setInputText('');
        setError(null);
        setShowMenu(false);
    };

    const handleSelectChat = (chatItem) => {
        // Hiển thị tất cả chat history từ đầu đến chat được chọn (bao gồm cả chat được chọn)
        const chatId = chatItem.chat_id || chatItem.chatId;
        const selectedIndex = chatHistory.findIndex(item =>
            (item.chat_id || item.chatId) === chatId
        );

        // Loại bỏ duplicates dựa trên chat_id trước khi xử lý
        const uniqueHistory = chatHistory
            .slice(0, selectedIndex + 1)
            .filter((item, index, self) =>
                index === self.findIndex(t => (t.chat_id || t.chatId) === (item.chat_id || item.chatId))
            );

        const messagesToShow = uniqueHistory
            .sort((a, b) => new Date(a.created_at || a.createdAt) - new Date(b.created_at || b.createdAt))
            .flatMap(item => [
                {
                    id: `q-${item.chat_id || item.chatId}`,
                    type: 'user',
                    text: item.question_text || item.questionText || '',
                    timestamp: item.created_at || item.createdAt
                },
                {
                    id: `a-${item.chat_id || item.chatId}`,
                    type: 'ai',
                    text: cleanResponseText(item.ai_response || item.aiResponse || ''),
                    timestamp: item.created_at || item.createdAt
                }
            ]);

        setMessages(messagesToShow);
        setShowMenu(false);
        // Scroll to bottom
        setTimeout(() => scrollToBottom(), 100);
    };

    // Group chat history by date and get unique chat sessions
    const getChatSessions = () => {
        if (!chatHistory || chatHistory.length === 0) return [];

        // Group by date
        const groupedByDate = chatHistory.reduce((acc, item) => {
            const createdAt = item.created_at || item.createdAt;
            const date = new Date(createdAt).toLocaleDateString('vi-VN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            if (!acc[date]) {
                acc[date] = [];
            }
            acc[date].push(item);
            return acc;
        }, {});

        // Flatten and return unique chats with date info
        const sessions = [];
        Object.keys(groupedByDate).forEach(date => {
            const chats = groupedByDate[date];
            chats.forEach((chat, index) => {
                sessions.push({
                    ...chat,
                    displayDate: index === 0 ? date : null, // Only show date for first item of each day
                    groupDate: date
                });
            });
        });

        return sessions.sort((a, b) =>
            new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt)
        );
    };

    const capabilities = [
        'Trả lời câu hỏi về dữ liệu khảo sát',
        'Phân tích kết quả khảo sát',
        'Tìm kiếm thông tin trong phản hồi',
        'Đưa ra gợi ý cải thiện khảo sát',
        'Giải thích các thống kê và xu hướng'
    ];

    // Không render nếu không mở
    if (!isOpen) {
        return null;
    }

    return (
        <div className="ai-chat-overlay" onClick={(e) => e.target === e.currentTarget && handleToggleChat()}>
            <div className="ai-chat-container" ref={chatContainerRef} onClick={(e) => e.stopPropagation()}>
                {/* Sidebar Menu */}
                {showMenu && (
                    <>
                        <div className="ai-chat-menu-backdrop" onClick={() => setShowMenu(false)}></div>
                        <div className="ai-chat-menu-dropdown" ref={menuRef}>
                            <div className="ai-chat-menu-header">
                                <h3>Menu</h3>
                                <button
                                    className="ai-chat-menu-close-btn"
                                    onClick={() => setShowMenu(false)}
                                    aria-label="Close menu"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                            <div className="ai-chat-menu-content">
                                <button
                                    className="ai-chat-menu-item ai-chat-menu-item-new"
                                    onClick={handleNewChat}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                    </svg>
                                    <span>Tạo đoạn chat mới</span>
                                </button>

                                <div className="ai-chat-menu-divider"></div>

                                <div className="ai-chat-menu-history">
                                    <div className="ai-chat-menu-history-title">Lịch sử chat</div>
                                    {chatHistory && chatHistory.length > 0 ? (
                                        <div className="ai-chat-menu-history-list">
                                            {getChatSessions().map((chatItem, index) => (
                                                <div key={chatItem.chat_id || index}>
                                                    {chatItem.displayDate && (
                                                        <div className="ai-chat-menu-history-date">
                                                            {chatItem.displayDate}
                                                        </div>
                                                    )}
                                                    <button
                                                        className="ai-chat-menu-item ai-chat-menu-item-history"
                                                        onClick={() => handleSelectChat(chatItem)}
                                                        title={chatItem.question_text || chatItem.questionText}
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                                        </svg>
                                                        <span className="ai-chat-menu-item-text">
                                                            {(chatItem.question_text || chatItem.questionText || '').length > 40
                                                                ? `${(chatItem.question_text || chatItem.questionText || '').substring(0, 40)}...`
                                                                : (chatItem.question_text || chatItem.questionText || '')}
                                                        </span>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="ai-chat-menu-empty">
                                            <p>Chưa có lịch sử chat</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Header */}
                <div className="ai-chat-header">
                    <div className="ai-chat-menu-wrapper">
                        <button
                            className="ai-chat-menu-btn"
                            aria-label="Menu"
                            onClick={() => setShowMenu(!showMenu)}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="3" y1="6" x2="21" y2="6"></line>
                                <line x1="3" y1="12" x2="21" y2="12"></line>
                                <line x1="3" y1="18" x2="21" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div className="ai-chat-title">
                        <span className="ai-chat-logo"><i className="fa-solid fa-robot"></i></span>
                        <span>AI Assistant</span>
                    </div>
                    <div className="ai-chat-header-actions">
                        {/* <button className="ai-chat-icon-btn" aria-label="Options">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="7" height="7"></rect>
                                <rect x="14" y="3" width="7" height="7"></rect>
                                <rect x="14" y="14" width="7" height="7"></rect>
                                <rect x="3" y="14" width="7" height="7"></rect>
                            </svg>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '4px' }}>
                                <path d="M3 3L9 9M9 3L3 9"></path>
                            </svg>
                        </button> */}
                        <button className="ai-chat-close-btn" onClick={handleToggleChat} aria-label="Close">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="ai-chat-content">
                    {/* Ingestion Status */}
                    {(isIngesting || ingestionStatus) && (
                        <div className="ai-chat-ingest-status">
                            {isIngesting && (
                                <>
                                    <div className="ai-chat-ingest-spinner"></div>
                                    <span>{ingestionStatus}</span>
                                </>
                            )}
                            {!isIngesting && ingestionStatus && (
                                <>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                    <span>{ingestionStatus}</span>
                                </>
                            )}
                        </div>
                    )}

                    {/* AI Summary Section */}
                    {summary && (
                        <div className="ai-chat-summary-section">
                            <div className="ai-chat-summary-header">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                </svg>
                                <span>Bản tóm tắt do AI tạo</span>
                            </div>
                            <div className={`ai-chat-summary-content ${isSummaryExpanded ? 'expanded' : ''}`}>
                                <p>{summary}</p>
                            </div>
                            <button
                                className="ai-chat-expand-btn"
                                onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    {isSummaryExpanded ? (
                                        <polyline points="18 15 12 9 6 15"></polyline>
                                    ) : (
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    )}
                                </svg>
                            </button>
                        </div>
                    )}

                    {/* Capabilities Section */}
                    <div className="ai-chat-capabilities-section">
                        <h3 className="ai-chat-capabilities-title">AI Assistant có thể làm gì?</h3>
                        <ul className="ai-chat-capabilities-list">
                            {capabilities.map((capability, index) => (
                                <li key={index}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                    </svg>
                                    {capability}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Messages */}
                    <div className="ai-chat-messages">
                        {messages.length === 0 && (
                            <div className="ai-chat-empty-state">
                                <p>Chào mừng bạn đến với AI Assistant! Hãy đặt câu hỏi về khảo sát của bạn.</p>
                            </div>
                        )}
                        {messages.map((message) => (
                            <div key={message.id} className={`ai-chat-message ${message.type}`}>
                                <div className="ai-chat-message-content">
                                    {message.text || message.questionText || message.aiResponse || '(Không có nội dung)'}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="ai-chat-message ai">
                                <div className="ai-chat-message-content">
                                    <div className="ai-chat-typing-indicator">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {error && (
                        <div className="ai-chat-error">
                            <span>{error}</span>
                            <button onClick={() => setError(null)}>×</button>
                        </div>
                    )}
                </div>

                {/* Input Section */}
                <div className="ai-chat-input-section">
                    {/* <button className="ai-chat-input-icon-btn" aria-label="Data source">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="7"></rect>
                            <rect x="14" y="3" width="7" height="7"></rect>
                            <rect x="14" y="14" width="7" height="7"></rect>
                            <rect x="3" y="14" width="7" height="7"></rect>
                        </svg>
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '4px' }}>
                            <polyline points="6 3 6 9"></polyline>
                            <polyline points="3 6 6 3 9 6"></polyline>
                        </svg>
                    </button>
                    <button className="ai-chat-input-icon-btn" aria-label="Filter">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                        </svg>
                    </button> */}
                    <textarea
                        className="ai-chat-input"
                        placeholder="Hỏi AI Assistant..."
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={isLoading}
                        rows={1}
                    />
                    <button
                        className="ai-chat-send-btn"
                        onClick={handleSendMessage}
                        disabled={!inputText.trim() || isLoading}
                        aria-label="Send"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

// Floating Chat Button Component
export const AIChatButton = ({ onClick, surveyId }) => {
    return (
        <button
            className="ai-chat-floating-btn"
            onClick={onClick}
            aria-label="Open AI Chat"
            title="Chat với AI Assistant"
        >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span className="ai-chat-badge">AI</span>
        </button>
    );
};

export default AIChat;

