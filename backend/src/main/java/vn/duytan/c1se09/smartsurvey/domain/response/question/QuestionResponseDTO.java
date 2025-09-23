package vn.duytan.c1se09.smartsurvey.domain.response.question;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class QuestionResponseDTO {
    private Long id;
    private Long surveyId;
    private String surveyTitle;
    private String questionText;
    private String questionType;
    private String questionTypeDescription;
    private Boolean isRequired;
    
    private Integer displayOrder;
    
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
} 