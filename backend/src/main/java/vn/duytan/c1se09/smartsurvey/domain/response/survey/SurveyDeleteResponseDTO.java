package vn.duytan.c1se09.smartsurvey.domain.response.survey;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class SurveyDeleteResponseDTO {
    private Long id;
    private String message;
}
