package vn.duytan.c1se09.smartsurvey.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Entity đại diện cho bảng ai_sentiment
 * Lưu trữ kết quả phân tích sentiment của khảo sát
 */
@Entity
@Table(name = "ai_sentiment")
@Getter
@Setter
public class AiSentiment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "sentiment_id")
    private Long sentimentId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "survey_id", nullable = false)
    private Survey survey;

    @Column(name = "total_responses", nullable = false)
    private Integer totalResponses = 0;

    @Column(name = "positive_percent", precision = 5, scale = 2)
    private BigDecimal positivePercent = BigDecimal.ZERO;

    @Column(name = "neutral_percent", precision = 5, scale = 2)
    private BigDecimal neutralPercent = BigDecimal.ZERO;

    @Column(name = "negative_percent", precision = 5, scale = 2)
    private BigDecimal negativePercent = BigDecimal.ZERO;

    @Column(name = "details", columnDefinition = "JSON")
    private String details;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
