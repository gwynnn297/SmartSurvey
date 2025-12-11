package vn.duytan.c1se09.smartsurvey.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Entity đại diện cho bảng ai_chat_logs
 * Lưu trữ lịch sử chat với AI cho mỗi survey
 */
@Entity
@Table(name = "ai_chat_logs")
@Getter
@Setter
public class AiChatLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "chat_id")
    private Long chatId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "survey_id", nullable = false)
    private Survey survey;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "question_text", nullable = false, columnDefinition = "LONGTEXT")
    private String questionText;

    @Column(name = "ai_response", nullable = false, columnDefinition = "LONGTEXT")
    private String aiResponse;

    @Column(name = "context", columnDefinition = "JSON")
    private String context;

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


