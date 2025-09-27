package vn.duytan.c1se09.smartsurvey.domain.response.survey;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class SurveyDetailResponseDTO {
    private Long id;
    private String title;
    private String description;
    private String status;
    private String aiPrompt;
    private Long categoryId;
    private String categoryName;
    private Long userId;
    private String userName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // Danh sách câu hỏi (compact version)
    private List<QuestionCompactDTO> questions;

    @Data
    public static class QuestionCompactDTO {
        private Long id;
        private String text;
        private String type;
        private Boolean required;
        private Integer order;
        private List<OptionCompactDTO> options;
    }

    @Data
    public static class OptionCompactDTO {
        private Long id;
        private String text;
    }
}