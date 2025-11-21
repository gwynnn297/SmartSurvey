package vn.duytan.c1se09.smartsurvey.domain.response.team;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.duytan.c1se09.smartsurvey.util.constant.SurveyPermissionRole;

import java.time.LocalDateTime;

/**
 * DTO đại diện cho survey được share với một team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeamSurveyResponseDTO {
    private Long surveyId;
    private String title;
    private String description;
    private String status;
    private Long ownerId;
    private String ownerName;
    private SurveyPermissionRole permission;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}






























