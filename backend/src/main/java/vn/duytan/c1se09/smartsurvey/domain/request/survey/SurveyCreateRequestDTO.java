package vn.duytan.c1se09.smartsurvey.domain.request.survey;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SurveyCreateRequestDTO {
    @NotBlank(message = "Tiêu đề khảo sát không được để trống")
    private String title;
    private String description;
    private Long categoryId;
    private String aiPrompt; // tùy chọn
}
