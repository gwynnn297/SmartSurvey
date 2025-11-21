package vn.duytan.c1se09.smartsurvey.domain.response.team;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.duytan.c1se09.smartsurvey.util.constant.SurveyPermissionRole;

import java.time.LocalDateTime;

/**
 * DTO trả về thông tin member trong team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeamMemberResponseDTO {
    private Long memberId;
    private Long userId;
    private String fullName;
    private String email;
    private SurveyPermissionRole role; // Role trong team (OWNER, EDITOR, ANALYST, VIEWER)
    private LocalDateTime joinedAt;
}











