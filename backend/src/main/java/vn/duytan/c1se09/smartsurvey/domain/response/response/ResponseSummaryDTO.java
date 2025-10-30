package vn.duytan.c1se09.smartsurvey.domain.response.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class ResponseSummaryDTO {
    private Long responseId;
    private Long surveyId;
    private Long userId;
    private String requestToken;
    private LocalDateTime submittedAt;
    private Integer durationSeconds;
    private String completionStatus; // completed | partial | dropped
}


