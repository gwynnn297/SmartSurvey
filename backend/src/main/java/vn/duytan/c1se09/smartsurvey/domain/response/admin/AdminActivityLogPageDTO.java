package vn.duytan.c1se09.smartsurvey.domain.response.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO trả về danh sách activity logs với phân trang cho admin
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminActivityLogPageDTO {
    private List<ActivityLogDTO> activityLogs;
    private Long totalElements;
    private Integer totalPages;
    private Integer currentPage;
    private Integer pageSize;
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ActivityLogDTO {
        private Long logId;
        private Long userId;           // User thực hiện action
        private String userName;       // Tên user
        private String userEmail;      // Email user
        private String actionType;     // Loại action
        private String description;    // Mô tả
        private Long targetId;         // ID của entity bị tác động
        private String targetTable;     // Tên bảng của entity
        private LocalDateTime createdAt;
    }
}


