package vn.duytan.c1se09.smartsurvey.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import vn.duytan.c1se09.smartsurvey.util.constant.SurveyStatusEnum;

import java.time.LocalDateTime;

/**
 * Entity đại diện cho bảng surveys
 * Lưu trữ thông tin khảo sát
 */
@Entity
@Table(name = "surveys")
@Getter
@Setter
@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
public class Survey {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "survey_id")
    private Long surveyId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @Column(name = "ai_prompt", columnDefinition = "LONGTEXT")
    private String aiPrompt;

    @Column(name = "target_audience", length = 200)
    private String targetAudience;

    @Column(name = "number_of_questions", nullable = false)
    private Integer numberOfQuestions = 5;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private SurveyStatusEnum status = SurveyStatusEnum.draft;

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