package vn.duytan.c1se09.smartsurvey.domain.response.survey;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO cho API check survey status
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SurveyStatusResponseDTO {
    private String status; // "active", "closed", "not_found"
    private String message;
    private Long surveyId;
    private String title;
}
