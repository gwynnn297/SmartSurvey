package vn.duytan.c1se09.smartsurvey.domain.response.team;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * DTO trả về danh sách surveys của team kèm permissions summary
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeamSurveysResponseDTO {
    private List<TeamSurveyResponseDTO> surveys;
    private Map<String, Object> permissions; // Summary permissions của team
}



























