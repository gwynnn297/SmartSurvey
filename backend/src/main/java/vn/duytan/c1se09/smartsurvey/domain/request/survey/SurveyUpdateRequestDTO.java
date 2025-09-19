package vn.duytan.c1se09.smartsurvey.domain.request.survey;

import lombok.Data;
import vn.duytan.c1se09.smartsurvey.util.constant.SurveyStatusEnum;

@Data
public class SurveyUpdateRequestDTO {
    private String title; // optional
    private String description; // optional
    private Long categoryId; // optional
    private String aiPrompt; // optional
    private SurveyStatusEnum status; // optional
}
