package vn.duytan.c1se09.smartsurvey.domain.request.question;

import lombok.Data;
import vn.duytan.c1se09.smartsurvey.util.constant.QuestionTypeEnum;

@Data
public class QuestionUpdateRequestDTO {
    private String questionText; // optional
    private QuestionTypeEnum questionType; // optional
    private Boolean isRequired; // optional
    
        // Cấu hình cho các question types phức tạp (optional)
    private RankingQuestionConfigDTO rankingConfig;
    private FileUploadQuestionConfigDTO fileUploadConfig;
    private DateTimeQuestionConfigDTO dateTimeConfig;
} 