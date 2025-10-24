package vn.duytan.c1se09.smartsurvey.dto.ai;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * DTO for regenerating a single question
 */
@Data
public class QuestionRegenerateRequestDTO {

    @NotBlank(message = "Original prompt is required for context")
    @Size(max = 1000, message = "Original prompt must be less than 1000 characters")
    private String originalPrompt;

    @Size(max = 200, message = "Target audience must be less than 200 characters")
    private String targetAudience;

    @Size(max = 100, message = "Category name must be less than 100 characters")
    private String categoryName;

    @Size(max = 500, message = "Context hint must be less than 500 characters")
    private String contextHint;

    @Size(max = 200, message = "Question type hint must be less than 200 characters")
    private String questionTypeHint; // Gợi ý loại câu hỏi muốn tạo
}