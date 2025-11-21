package vn.duytan.c1se09.smartsurvey.domain.response.survey;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.duytan.c1se09.smartsurvey.util.constant.SurveyPermissionRole;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO trả về danh sách permissions sau khi cập nhật
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SurveyPermissionResponseDTO {
    private Long surveyId;
    private List<SharedUserDTO> users;
    // Danh sách cảnh báo/thông báo (ví dụ: user đã có permission, duplicate userId, etc.)
    private List<String> warnings;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SharedUserDTO {
        private Long userId;
        private String email;
        private String fullName;
        private SurveyPermissionRole permission;
        private Long grantedBy;
        private String grantedByName;
        private LocalDateTime updatedAt;
        // Team bị ràng buộc (nếu có) - chỉ dùng restrictedTeamId
        private Long restrictedTeamId;
        private String restrictedTeamName;
    }
}


















