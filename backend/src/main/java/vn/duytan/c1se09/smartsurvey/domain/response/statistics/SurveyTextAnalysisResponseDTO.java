package vn.duytan.c1se09.smartsurvey.domain.response.statistics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO for Survey Text Analysis Response
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SurveyTextAnalysisResponseDTO {

    private OpenEndedSummaryDTO openEndedSummary;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OpenEndedSummaryDTO {
        private Integer totalAnswers;
        private Integer avgLength;
        private String keyInsights;
        private List<CommonKeywordDTO> commonKeywords;
        private List<ThemeDTO> themes;

        @Data
        @Builder
        @NoArgsConstructor
        @AllArgsConstructor
        public static class CommonKeywordDTO {
            private String word;
            private Integer frequency;
        }

        @Data
        @Builder
        @NoArgsConstructor
        @AllArgsConstructor
        public static class ThemeDTO {
            private String theme;
            private Integer mentions;
            private String sentiment; // "positive", "neutral", "negative"
        }
    }
}