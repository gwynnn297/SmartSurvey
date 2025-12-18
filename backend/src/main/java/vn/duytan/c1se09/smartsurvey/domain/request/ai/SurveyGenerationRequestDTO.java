package vn.duytan.c1se09.smartsurvey.domain.request.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * DTO for AI Survey Generation Request
 */
@Data
public class SurveyGenerationRequestDTO {

    @NotBlank(message = "Title is required")
    @Size(max = 100, message = "Title must be less than 100 characters")
    private String title;

    @NotBlank(message = "Description is required")
    @Size(max = 500, message = "Description must be less than 500 characters")
    private String description;

    private Long categoryId; // Không bắt buộc nữa

    @Size(max = 100, message = "Category name must be less than 100 characters")
    private String categoryName;

    @NotBlank(message = "AI prompt is required")
    @Size(min = 10, max = 1000, message = "AI prompt must be between 10 and 1000 characters")
    private String aiPrompt;

    @Size(max = 200, message = "Target audience must be less than 200 characters")
    private String targetAudience;

    @NotNull(message = "Số lượng câu hỏi không được để trống")
    @Min(value = 2, message = "Số lượng câu hỏi tối thiểu là 2")
    @Max(value = 20, message = "Số lượng câu hỏi tối đa là 20")
    @JsonProperty("numberOfQuestions")
    private Integer numberOfQuestions;

    /**
     * Danh sách loại câu hỏi ưu tiên theo thứ tự (rating, single_choice, multiple_choice, ranking, open_ended, boolean_, date_time, file_upload)
     */
    @JsonProperty("questionTypePriorities")
    private java.util.List<String> questionTypePriorities;

    /**
     * ✅ Data đã được generate bởi AI ở frontend (sau khi user preview và accept)
     * Nếu có field này thì backend KHÔNG GỌI AI nữa, chỉ save thẳng vào DB
     */
    @JsonProperty("aiGeneratedData")
    private vn.duytan.c1se09.smartsurvey.domain.response.ai.SurveyGenerationResponseDTO aiGeneratedData;
}