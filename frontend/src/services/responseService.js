// import { apiClient } from './authService';

// /**
//  * Chuẩn hoá payload theo backend:
//  * POST /responses
//  * Body: {
//  *   surveyId: number,
//  *   requestToken?: string,
//  *   answers: Array<{ questionId: number, optionId?: number, answerText?: string }>
//  * }
//  * Lưu ý: frontend hiện không nắm optionId ở public nên gửi answerText.
//  */
// function buildSubmissionPayload(surveyId, responses, survey) {
//     const answers = [];

//     const pushAnswer = (questionId, value, questionType) => {
//         if (value === undefined || value === null) return;
//         if (Array.isArray(value)) {
//             value.forEach(v => {
//                 if (questionType === 'multiple-choice-single' || questionType === 'multiple-choice-multiple') {
//                     // gửi optionId
//                     answers.push({ questionId, optionId: isNaN(Number(v)) ? undefined : Number(v), answerText: isNaN(Number(v)) ? String(v) : undefined });
//                 } else {
//                     answers.push({ questionId, answerText: String(v) });
//                 }
//             });
//         } else {
//             if (questionType === 'multiple-choice-single' || questionType === 'multiple-choice-multiple') {
//                 answers.push({ questionId, optionId: isNaN(Number(value)) ? undefined : Number(value), answerText: isNaN(Number(value)) ? String(value) : undefined });
//             } else {
//                 answers.push({ questionId, answerText: String(value) });
//             }
//         }
//     };

//     if (survey && Array.isArray(survey.questions)) {
//         for (const q of survey.questions) {
//             pushAnswer(q.id, responses[q.id], q.type);
//         }
//     } else {
//         Object.entries(responses || {}).forEach(([questionId, value]) => {
//             pushAnswer(Number(questionId), value, undefined);
//         });
//     }

//     const requestToken = localStorage.getItem('respondent_request_token') ||
//         (() => {
//             const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
//             try { localStorage.setItem('respondent_request_token', token); } catch { }
//             return token;
//         })();

//     return { surveyId, requestToken, answers };
// }

// export const responseService = {
//     /**
//      * Gửi tất cả câu trả lời lên server
//      * payload dạng gợi ý:
//      * {
//      *   surveyId: number,
//      *   requestToken: string,
//      *   answers: Array<{ questionId: number, value: string | string[] }>
//      * }
//      */
//     submitResponses: async (surveyId, responses, survey) => {
//         const payload = buildSubmissionPayload(surveyId, responses, survey);
//         try {
//             // Ước lượng endpoint theo backend: '/responses'
//             // Nếu backend triển khai theo survey scope: đổi thành `/surveys/${surveyId}/responses`
//             const response = await apiClient.post('/responses', payload);
//             return response.data;
//         } catch (error) {
//             console.error('Submit responses error:', error);
//             throw error;
//         }
//     }
// };

// export default responseService;

import { apiClient } from './authService';
import { generateUniqueToken } from '../utils/tokenGenerator';

/**
 * Chuẩn hoá payload theo backend:
 * POST /responses
 * Body: {
 *   surveyId: number,
 *   requestToken?: string,
 *   answers: Array<{ questionId: number, optionId?: number, answerText?: string }>
 * }
 */
function buildSubmissionPayload(surveyId, responses, survey) {
    const answers = [];

    const pushAnswer = (questionId, value, questionType) => {
        if (value === undefined || value === null) return;

        // ✅ Fix: xử lý riêng từng loại câu hỏi đúng theo backend
        if (Array.isArray(value)) {
            value.forEach(v => pushAnswer(questionId, v, questionType));
            return;
        }

        switch (questionType) {
            case 'multiple-choice-single':
            case 'multiple-choice-multiple': {
                const numVal = Number(value);
                if (!isNaN(numVal)) {
                    // ✅ Backend yêu cầu optionId (bắt buộc)
                    answers.push({ questionId, optionId: numVal });
                } else {
                    // fallback — nếu giá trị không phải số
                    answers.push({ questionId, answerText: String(value) });
                }
                break;
            }
            case 'boolean': {
                // ✅ Backend cho phép answerText = true/false/yes/no
                answers.push({ questionId, answerText: String(value).toLowerCase() });
                break;
            }
            case 'open-text':
            case 'rating-scale':
            default: {
                answers.push({ questionId, answerText: String(value) });
                break;
            }
        }
    };

    if (survey && Array.isArray(survey.questions)) {
        for (const q of survey.questions) {
            pushAnswer(q.id, responses[q.id], q.type);
        }
    } else {
        Object.entries(responses || {}).forEach(([questionId, value]) => {
            pushAnswer(Number(questionId), value, undefined);
        });
    }

    const requestToken =
        (typeof window !== 'undefined' && localStorage.getItem('respondent_request_token')) ||
        (() => {
            const token = generateUniqueToken();
            try { localStorage.setItem('respondent_request_token', token); } catch { }
            return token;
        })();

    return { surveyId, requestToken, answers };
}

export const responseService = {
    submitResponses: async (surveyId, responses, survey) => {
        const payload = buildSubmissionPayload(surveyId, responses, survey);
        console.log('📦 Payload gửi lên backend:', JSON.stringify(payload, null, 2));
        try {
            const response = await apiClient.post('/responses', payload);
            return response.data;
        } catch (error) {
            console.error('❌ Submit responses error:', error);
            throw error;
        }
    }
};

export default responseService;
