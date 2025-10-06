package vn.duytan.c1se09.smartsurvey.domain.request.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO request cho phân tích sentiment
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SentimentAnalysisRequestDTO {
    
    private Long surveyId;
    private Long questionId; // Optional: phân tích cho câu hỏi cụ thể
    
    /**
     * Response từ AI service khi trigger phân tích
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TriggerResponse {
        private Long surveyId;
        private Long result; // sentiment_id
        private String createdAt;
        private String status;
        private String message;
    }
}
