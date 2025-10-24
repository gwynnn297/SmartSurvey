package vn.duytan.c1se09.smartsurvey.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * DTO for AI Sentiment Analysis Response
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SentimentAnalysisResponseDTO {

    private boolean success;
    private String message;

    @JsonProperty("survey_id")
    private Long surveyId;

    @JsonProperty("sentiment_id")
    private Long sentimentId;

    @JsonProperty("total_responses")
    private Integer totalResponses;

    @JsonProperty("positive_percent")
    private Double positivePercent;

    @JsonProperty("neutral_percent")
    private Double neutralPercent;

    @JsonProperty("negative_percent")
    private Double negativePercent;

    private Map<String, Integer> counts;

    @JsonProperty("created_at")
    private LocalDateTime createdAt;

    @JsonProperty("error_details")
    private Object errorDetails;

    // Factory methods for common responses
    public static SentimentAnalysisResponseDTO success(Long surveyId, Long sentimentId, String message) {
        return SentimentAnalysisResponseDTO.builder()
                .success(true)
                .message(message)
                .surveyId(surveyId)
                .sentimentId(sentimentId)
                .build();
    }

    public static SentimentAnalysisResponseDTO success(Long surveyId, String message,
                                                       Integer totalResponses, Double positivePercent,
                                                       Double neutralPercent, Double negativePercent,
                                                       Map<String, Integer> counts, LocalDateTime createdAt) {
        return SentimentAnalysisResponseDTO.builder()
                .success(true)
                .message(message)
                .surveyId(surveyId)
                .totalResponses(totalResponses)
                .positivePercent(positivePercent)
                .neutralPercent(neutralPercent)
                .negativePercent(negativePercent)
                .counts(counts)
                .createdAt(createdAt)
                .build();
    }

    public static SentimentAnalysisResponseDTO error(Long surveyId, String message) {
        return SentimentAnalysisResponseDTO.builder()
                .success(false)
                .message(message)
                .surveyId(surveyId)
                .build();
    }

    public static SentimentAnalysisResponseDTO error(Long surveyId, String message, Object errorDetails) {
        return SentimentAnalysisResponseDTO.builder()
                .success(false)
                .message(message)
                .surveyId(surveyId)
                .errorDetails(errorDetails)
                .build();
    }
}



