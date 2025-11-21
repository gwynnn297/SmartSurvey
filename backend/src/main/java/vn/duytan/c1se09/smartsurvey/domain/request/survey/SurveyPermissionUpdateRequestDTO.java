package vn.duytan.c1se09.smartsurvey.domain.request.survey;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.duytan.c1se09.smartsurvey.util.constant.SurveyPermissionRole;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SurveyPermissionUpdateRequestDTO {

    @Valid
    private List<TeamAccessDTO> teamAccess;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TeamAccessDTO {
        private Long userId; 
        private String email; 
        private Long restrictedTeamId; // Team để giới hạn quyền (user chỉ có quyền khi là member của team này)

        @NotNull(message = "permission không được để trống")
        private SurveyPermissionRole permission;
    }
}
