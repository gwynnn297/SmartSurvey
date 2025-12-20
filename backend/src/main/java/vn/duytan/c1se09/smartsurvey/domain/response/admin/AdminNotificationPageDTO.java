package vn.duytan.c1se09.smartsurvey.domain.response.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO trả về danh sách admin notifications với phân trang
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminNotificationPageDTO {
    private List<NotificationDTO> notifications;
    private Long totalElements;
    private Integer totalPages;
    private Integer currentPage;
    private Integer pageSize;
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NotificationDTO {
        private Long notificationId;
        private Long userId;           // User nhận notification
        private String userName;       // Tên user nhận notification
        private String userEmail;       // Email user nhận notification
        private String type;            // Notification type
        private String title;
        private String message;
        private String relatedEntityType;
        private Long relatedEntityId;
        private Boolean isRead;
        private LocalDateTime createdAt;
    }
}


