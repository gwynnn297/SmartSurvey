package vn.duytan.c1se09.smartsurvey.domain.response.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO trả về chi tiết thông tin user cho admin
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminUserDetailDTO {
    // Basic info
    private Long userId;
    private String fullName;
    private String email;
    private String role;
    private Boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Profile info
    private UserProfileDTO profile;
    
    // Statistics
    private Long surveysCount;        // Số surveys đã tạo
    private Long responsesCount;      // Số responses đã tham gia
    private LocalDateTime lastLogin;  // Lần đăng nhập cuối (từ activity_log)
    
    // Recent admin activities for this user (from notifications)
    private List<AdminActivityDTO> recentAdminActivities;
    
    // Recent user activities (from activity_log)
    private List<UserActivityDTO> recentUserActivities;
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserProfileDTO {
        private String gender;
        private String ageBand;
        private String region;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AdminActivityDTO {
        private Long notificationId;
        private String type;
        private String title;
        private String message;
        private LocalDateTime createdAt;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserActivityDTO {
        private Long logId;
        private String actionType;
        private String description;
        private Long targetId;
        private String targetTable;
        private LocalDateTime createdAt;
    }
}


