package vn.duytan.c1se09.smartsurvey.dto.ai;

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

    @NotNull(message = "Category ID is required")
    private Long categoryId;

    @NotBlank(message = "AI prompt is required")
    @Size(min = 10, max = 1000, message = "AI prompt must be between 10 and 1000 characters")
    private String aiPrompt;

    @Size(max = 200, message = "Target audience must be less than 200 characters")
    private String targetAudience;

    @NotNull(message = "Số lượng câu hỏi không được để trống")
    @Min(value = 3, message = "Số lượng câu hỏi tối thiểu là 3")
    @Max(value = 20, message = "Số lượng câu hỏi tối đa là 20")
    @JsonProperty("numberOfQuestions")
    private Integer numberOfQuestions;
}