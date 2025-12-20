package vn.duytan.c1se09.smartsurvey.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Entity đại diện cho bảng notifications
 * Lưu trữ thông báo cho user
 */
@Entity
@Table(name = "notifications")
@Getter
@Setter
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "notification_id")
    private Long notificationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false)
    private NotificationType type;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "message", columnDefinition = "TEXT")
    private String message;

    @Column(name = "related_entity_type", length = 50)
    private String relatedEntityType; // "survey", "team", "response"

    @Column(name = "related_entity_id")
    private Long relatedEntityId;

    @Column(name = "is_read", nullable = false)
    private Boolean isRead = false;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (isRead == null) {
            isRead = false;
        }
    }

    public enum NotificationType {
        TEAM_MEMBER_ADDED,        // Bạn đã được thêm vào team
        TEAM_MEMBER_ROLE_CHANGED, // Role của bạn trong team đã thay đổi
        TEAM_MEMBER_REMOVED,      // Bạn đã bị xóa khỏi team
        TEAM_MEMBER_LEFT,         // Thành viên đã rời team (gửi cho owner)
        TEAM_CREATED,             // Team mới được tạo
        TEAM_INVITATION,          // Lời mời tham gia team
        TEAM_INVITATION_REJECTED, // Lời mời tham gia team đã bị từ chối
        TEAM_DELETED,             // Team đã bị xóa
        SURVEY_SHARED,            // Survey được share với bạn
        SURVEY_PERMISSION_CHANGED, // Quyền của bạn trên survey đã thay đổi
        NEW_RESPONSE,             // Có response mới cho survey của bạn
        SURVEY_PUBLISHED,         // Survey đã được publish
        // Admin notifications
        ADMIN_UPDATE_USER_ROLE,   // Admin đã chỉnh sửa role của bạn
        ADMIN_DELETE_USER,        // Admin đã xóa tài khoản của bạn
        ADMIN_CREATE_USER,        // Admin đã tạo tài khoản cho bạn
        ADMIN_DEACTIVATE_USER,    // Admin đã vô hiệu hóa tài khoản của bạn
        ADMIN_ACTIVATE_USER       // Admin đã kích hoạt tài khoản của bạn
    }
}





