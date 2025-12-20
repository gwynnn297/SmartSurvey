package vn.duytan.c1se09.smartsurvey.domain.response.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO trả về danh sách users với phân trang cho admin
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminUserPageDTO {
    private List<UserDTO> users;
    private Long totalElements;
    private Integer totalPages;
    private Integer currentPage;
    private Integer pageSize;
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserDTO {
        private Long userId;
        private String fullName;
        private String email;
        private String role;
        private Boolean isActive;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }
}


