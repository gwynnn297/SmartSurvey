package vn.duytan.c1se09.smartsurvey.domain;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

import jakarta.persistence.*;

/**
 * Entity đại diện cho bảng ai_generation_history
 * Lưu trữ lịch sử tạo nội dung AI
 */
@Entity
@Table(name = "ai_generation_history")
@Getter
@Setter
public class AiGenerationHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "generation_id")
    private Long generationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "survey_id", nullable = false)
    private Survey survey;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id")
    private Question question;

    @Enumerated(EnumType.STRING)
    @Column(name = "generation_type", nullable = false)
    private GenerationType generationType;

    @Column(name = "ai_prompt", columnDefinition = "LONGTEXT")
    private String aiPrompt;

    @Column(name = "ai_response", columnDefinition = "LONGTEXT")
    private String aiResponse;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public enum AiGenerationType {
        single_refresh, full_refresh
    }

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}