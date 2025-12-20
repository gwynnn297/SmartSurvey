package vn.duytan.c1se09.smartsurvey.domain.response.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO trả về dashboard tổng quan cho admin
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminDashboardDTO {
    // User statistics
    private Long totalUsers;
    private Long totalAdmins;
    private Long totalCreators;
    private Long totalRespondents;
    private Long activeUsers;
    
    // Survey statistics
    private Long totalSurveys;
    private Long draftSurveys;
    private Long publishedSurveys;
    private Long archivedSurveys;
    
    // Other statistics
    private Long totalResponses;
    private Long totalQuestions;
    private Long totalCategories;
    
    // Recent admin activities (from notifications)
    private List<AdminActivityDTO> recentAdminActivities;
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AdminActivityDTO {
        private Long notificationId;
        private Long userId;           // User bị thay đổi
        private String userName;       // Tên user bị thay đổi
        private String userEmail;      // Email user bị thay đổi
        private Long adminUserId;      // Admin thực hiện (từ message)
        private String adminName;      // Tên admin (từ message)
        private String type;           // Notification type
        private String title;
        private String message;
        private LocalDateTime createdAt;
    }
}



