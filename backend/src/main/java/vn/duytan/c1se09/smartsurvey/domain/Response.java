package vn.duytan.c1se09.smartsurvey.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Entity đại diện cho bảng responses
 * Lưu trữ thông tin phản hồi khảo sát
 */
@Entity
@Table(name = "responses")
@Getter
@Setter
public class Response {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "response_id")
    private Long responseId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "survey_id", nullable = false)
    private Survey survey;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "request_token", length = 128)
    private String requestToken;

    @Column(name = "submitted_at", updatable = false)
    private LocalDateTime submittedAt;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    @PrePersist
    protected void onCreate() {
        submittedAt = LocalDateTime.now();
    }
}