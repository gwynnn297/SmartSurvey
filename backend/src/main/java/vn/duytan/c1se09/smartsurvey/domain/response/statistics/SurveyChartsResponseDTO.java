package vn.duytan.c1se09.smartsurvey.domain.response.statistics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO for Survey Charts Data Response
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SurveyChartsResponseDTO {

    private List<MultipleChoiceDataDTO> multipleChoiceData;
    private List<RatingDataDTO> ratingData;
    private List<BooleanDataDTO> booleanData;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MultipleChoiceDataDTO {
        private Long questionId;
        private String questionText;
        private List<ChartDataDTO> chartData;
        private String chartType; // "pie" or "bar"

        @Data
        @Builder
        @NoArgsConstructor
        @AllArgsConstructor
        public static class ChartDataDTO {
            private String option;
            private Integer count;
            private Double percentage;
        }
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RatingDataDTO {
        private Long questionId;
        private String questionText;
        private Double averageRating;
        private java.util.Map<String, Integer> distribution; // "1": 5, "2": 12, etc.
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BooleanDataDTO {
        private Long questionId;
        private String questionText;
        private Integer trueCount;
        private Integer falseCount;
        private Double truePercentage;
    }
}