package vn.duytan.c1se09.smartsurvey.domain.response.survey;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class SurveyUpdateResponseDTO {
    private Long id;
    private String title;
    private String message;
    private LocalDateTime updatedAt;
    private String updatedBy;
}
