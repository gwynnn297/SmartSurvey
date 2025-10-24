package vn.duytan.c1se09.smartsurvey.domain.response.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * DTO cho các ca AI inference cần review từ view v_ai_needs_review
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiNeedsReviewDTO {

    private Long inferenceId;
    private Long surveyId;
    private Long questionId;
    private Long answerId;
    private String rawText;
    private Integer predLabel;
    private BigDecimal predConf;
    private Integer finalLabel;
    private String status;
    private String predictedSentiment;
    private BigDecimal thresholdUsed;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
