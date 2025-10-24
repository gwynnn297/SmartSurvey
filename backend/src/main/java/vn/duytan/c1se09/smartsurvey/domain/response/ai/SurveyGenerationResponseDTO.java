package vn.duytan.c1se09.smartsurvey.domain.response.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO for AI Survey Generation Response
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SurveyGenerationResponseDTO {

    private boolean success;
    private String message;

    @JsonProperty("survey_id")
    private Long surveyId;

    @JsonProperty("generated_survey")
    private GeneratedSurveyDataDTO generatedSurvey;

    @JsonProperty("error_details")
    private Object errorDetails;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GeneratedSurveyDataDTO {
        private String title;
        private String description;
        private List<GeneratedQuestionDTO> questions;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonPropertyOrder({ "question_text", "question_type", "is_required", "display_order", "options" })
    public static class GeneratedQuestionDTO {

        @JsonProperty("question_text")
        private String questionText;

        @JsonProperty("question_type")
        private String questionType;

        @JsonProperty("is_required")
        private boolean isRequired;

        @JsonProperty("display_order")
        private int displayOrder;

        private List<GeneratedOptionDTO> options;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonPropertyOrder({ "option_text", "display_order" })
    public static class GeneratedOptionDTO {

        @JsonProperty("option_text")
        private String optionText;

        @JsonProperty("display_order")
        private int displayOrder;
    }

    // Factory methods for common responses
    public static SurveyGenerationResponseDTO success(Long surveyId, String message) {
        return new SurveyGenerationResponseDTO(true, message, surveyId, null, null);
    }

    public static SurveyGenerationResponseDTO success(Long surveyId, String message,
            GeneratedSurveyDataDTO generatedSurvey) {
        return new SurveyGenerationResponseDTO(true, message, surveyId, generatedSurvey, null);
    }

    public static SurveyGenerationResponseDTO error(String message) {
        return new SurveyGenerationResponseDTO(false, message, null, null, null);
    }

    public static SurveyGenerationResponseDTO error(String message, Object errorDetails) {
        return new SurveyGenerationResponseDTO(false, message, null, null, errorDetails);
    }
}