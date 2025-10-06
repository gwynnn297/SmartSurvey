package vn.duytan.c1se09.smartsurvey.domain.response.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * DTO cho AI inference summary từ view v_ai_sentiment_summary
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiInferenceSummaryDTO {
    
    private Long surveyId;
    private Integer totalInferences;
    private Integer autoApproved;
    private Integer needsReview;
    private Integer pending;
    private Integer negativeCount;
    private Integer neutralCount;
    private Integer positiveCount;
    private BigDecimal avgConfidence;
    private LocalDateTime firstAnalysis;
    private LocalDateTime lastAnalysis;
    
    /**
     * Tính phần trăm sentiment
     */
    public BigDecimal getPositivePercentage() {
        if (totalInferences == 0) return BigDecimal.ZERO;
        return new BigDecimal(positiveCount * 100.0 / totalInferences).setScale(2, BigDecimal.ROUND_HALF_UP);
    }
    
    public BigDecimal getNeutralPercentage() {
        if (totalInferences == 0) return BigDecimal.ZERO;
        return new BigDecimal(neutralCount * 100.0 / totalInferences).setScale(2, BigDecimal.ROUND_HALF_UP);
    }
    
    public BigDecimal getNegativePercentage() {
        if (totalInferences == 0) return BigDecimal.ZERO;
        return new BigDecimal(negativeCount * 100.0 / totalInferences).setScale(2, BigDecimal.ROUND_HALF_UP);
    }
    
    /**
     * Tính phần trăm tự động chấp nhận
     */
    public BigDecimal getAutoApprovalPercentage() {
        if (totalInferences == 0) return BigDecimal.ZERO;
        return new BigDecimal(autoApproved * 100.0 / totalInferences).setScale(2, BigDecimal.ROUND_HALF_UP);
    }
    
    /**
     * Tính phần trăm cần review
     */
    public BigDecimal getReviewPercentage() {
        if (totalInferences == 0) return BigDecimal.ZERO;
        return new BigDecimal(needsReview * 100.0 / totalInferences).setScale(2, BigDecimal.ROUND_HALF_UP);
    }
}

