package vn.duytan.c1se09.smartsurvey.domain.response.question;

import lombok.Data;
import vn.duytan.c1se09.smartsurvey.domain.request.question.DateTimeQuestionConfigDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.question.FileUploadQuestionConfigDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.question.RankingQuestionConfigDTO;

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

    // Cấu hình cho các question types phức tạp
    private RankingQuestionConfigDTO rankingConfig;
    private FileUploadQuestionConfigDTO fileUploadConfig;
    private DateTimeQuestionConfigDTO dateTimeConfig;
}