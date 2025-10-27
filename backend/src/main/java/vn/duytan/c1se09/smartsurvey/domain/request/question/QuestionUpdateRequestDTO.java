package vn.duytan.c1se09.smartsurvey.domain.request.question;

import lombok.Data;
import vn.duytan.c1se09.smartsurvey.util.constant.QuestionTypeEnum;

@Data
public class QuestionUpdateRequestDTO {
    private String questionText; // optional
    private QuestionTypeEnum questionType; // optional
    private Boolean isRequired; // optional

    // Note: Removed question config fields - using simplified approach
}