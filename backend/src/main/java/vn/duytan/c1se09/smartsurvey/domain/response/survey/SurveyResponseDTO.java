package vn.duytan.c1se09.smartsurvey.domain.response.survey;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class SurveyResponseDTO {
    private Long id;
    private String title;
    private String description;
    private String status;
    private String aiPrompt;
    private String targetAudience;
    private Integer numberOfQuestions;
    private Long categoryId;
    private String categoryName;
    private Long userId;
    private String userName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String shareLink;
}
