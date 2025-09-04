package vn.duytan.c1se09.smartsurvey.domain;

import jakarta.persistence.*;
import vn.duytan.c1se09.smartsurvey.util.constant.QuestionTypeEnum;

import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

/**
 * Entity đại diện cho bảng questions
 * Lưu trữ thông tin câu hỏi trong khảo sát
 */
@Entity
@Table(name = "questions")
@Getter
@Setter
public class Question {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "question_id")
    private Long questionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "survey_id", nullable = false)
    private Survey survey;

    @Column(name = "question_text", columnDefinition = "LONGTEXT")
    private String questionText;

    @Enumerated(EnumType.STRING)
    @Column(name = "question_type", nullable = false)
    private QuestionTypeEnum questionType;

    @Column(name = "is_required", nullable = false)
    private Boolean isRequired = true;

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