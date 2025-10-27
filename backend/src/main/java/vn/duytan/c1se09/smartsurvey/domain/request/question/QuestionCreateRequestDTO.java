package vn.duytan.c1se09.smartsurvey.domain.request.question;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import vn.duytan.c1se09.smartsurvey.util.constant.QuestionTypeEnum;

@Data
public class QuestionCreateRequestDTO {
    // Không bắt buộc vì có thể lấy từ URL
    private Long surveyId;

    @NotBlank(message = "Nội dung câu hỏi không được để trống")
    private String questionText;

    @NotNull(message = "Loại câu hỏi không được để trống")
    private QuestionTypeEnum questionType;

    private Boolean isRequired = true;

    // Note: Using simplified approach - only basic fields needed
    // surveyId, questionText, questionType, isRequired
}