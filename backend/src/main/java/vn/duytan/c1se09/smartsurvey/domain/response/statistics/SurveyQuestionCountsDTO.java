package vn.duytan.c1se09.smartsurvey.domain.response.statistics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SurveyQuestionCountsDTO {
    private Long surveyId;
    private int total;
    private Map<String, Integer> byType; // key: QuestionTypeEnum.name(), value: count
}


