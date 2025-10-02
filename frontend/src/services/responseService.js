import { apiClient } from './authService';

/**
 * Chuẩn hoá dữ liệu trả lời từ UI thành payload gửi backend
 * responses: Map<QuestionId, string | string[]>
 * survey: đối tượng survey có mảng questions (nếu có)
 */
function buildSubmissionPayload(surveyId, responses, survey) {
    const answers = [];

    // Nếu có cấu trúc survey.questions, duyệt theo thứ tự để đảm bảo đầy đủ
    if (survey && Array.isArray(survey.questions)) {
        for (const q of survey.questions) {
            const value = responses[q.id];
            if (value === undefined || value === null) continue;

            // Đưa về dạng thống nhất: string hoặc string[]
            if (Array.isArray(value)) {
                answers.push({ questionId: q.id, value: value });
            } else {
                answers.push({ questionId: q.id, value: String(value) });
            }
        }
    } else {
        // Fallback: duyệt trực tiếp từ map responses nếu không có survey.questions
        Object.entries(responses || {}).forEach(([questionId, value]) => {
            if (value === undefined || value === null) return;
            if (Array.isArray(value)) {
                answers.push({ questionId: Number(questionId), value: value });
            } else {
                answers.push({ questionId: Number(questionId), value: String(value) });
            }
        });
    }

    // requestToken để nhận diện client không đăng nhập (nếu có)
    const requestToken = localStorage.getItem('respondent_request_token') ||
        (() => {
            const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
            try { localStorage.setItem('respondent_request_token', token); } catch { }
            return token;
        })();

    return {
        surveyId,
        requestToken,
        answers,
    };
}

export const responseService = {
    /**
     * Gửi tất cả câu trả lời lên server
     * payload dạng gợi ý:
     * {
     *   surveyId: number,
     *   requestToken: string,
     *   answers: Array<{ questionId: number, value: string | string[] }>
     * }
     */
    submitResponses: async (surveyId, responses, survey) => {
        const payload = buildSubmissionPayload(surveyId, responses, survey);
        try {
            // Ước lượng endpoint theo backend: '/responses'
            // Nếu backend triển khai theo survey scope: đổi thành `/surveys/${surveyId}/responses`
            const response = await apiClient.post('/responses', payload);
            return response.data;
        } catch (error) {
            console.error('Submit responses error:', error);
            throw error;
        }
    }
};

export default responseService;

