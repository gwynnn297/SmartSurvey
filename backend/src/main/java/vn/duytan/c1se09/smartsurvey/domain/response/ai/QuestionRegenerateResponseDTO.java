package vn.duytan.c1se09.smartsurvey.domain.response.ai;

import lombok.Builder;
import lombok.Data;
import java.util.List;

/**
 * DTO for single question regeneration response
 */
@Data
@Builder
public class QuestionRegenerateResponseDTO {

    private boolean success;
    private String message;
    private GeneratedQuestionDTO question;

    @Data
    @Builder
    public static class GeneratedQuestionDTO {
        private String questionText;
        private String questionType;
        private boolean isRequired;
        private List<GeneratedOptionDTO> options;
    }

    @Data
    @Builder
    public static class GeneratedOptionDTO {
        private String optionText;
        private int displayOrder;
    }
}