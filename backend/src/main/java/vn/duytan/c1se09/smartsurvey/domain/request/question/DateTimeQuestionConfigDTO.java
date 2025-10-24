package vn.duytan.c1se09.smartsurvey.domain.request.question;

import lombok.Data;

@Data
public class DateTimeQuestionConfigDTO {
    private String dateFormat = "dd/MM/yyyy";
    private Boolean includeTime = false;
    private String minDate;
    private String maxDate;
}