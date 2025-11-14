package vn.duytan.c1se09.smartsurvey.domain.response.statistics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO for Survey Sentiment Analysis Response
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SurveySentimentResponseDTO {
    
    private SentimentOverallDTO overall;
    private List<SentimentByQuestionDTO> byQuestion;
    private List<SentimentTrendDTO> trends;
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SentimentOverallDTO {
        private Double positive;
        private Double neutral;
        private Double negative;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SentimentByQuestionDTO {
        private Long questionId;
        private String questionText;
        private Double positive;
        private Double neutral;
        private Double negative;
        private Integer totalResponses;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SentimentTrendDTO {
        private String date; // Format: "2025-10-15"
        private Integer positive;
        private Integer neutral;
        private Integer negative;
    }
}