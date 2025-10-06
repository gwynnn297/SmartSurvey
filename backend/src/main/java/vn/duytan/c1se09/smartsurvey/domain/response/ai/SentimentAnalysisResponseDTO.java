package vn.duytan.c1se09.smartsurvey.domain.response.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * DTO trả về kết quả phân tích sentiment
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SentimentAnalysisResponseDTO {
    
    private Long surveyId;
    private Long sentimentId;
    private Integer totalResponses;
    private BigDecimal positivePercent;
    private BigDecimal neutralPercent;
    private BigDecimal negativePercent;
    private String details;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    /**
     * Response đơn giản chỉ có phần trăm
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SimpleResponse {
        private Long surveyId;
        private BigDecimal positivePercent;
        private BigDecimal neutralPercent;
        private BigDecimal negativePercent;
        private Integer sampleSize;
        private LocalDateTime generatedAt;
    }
}
