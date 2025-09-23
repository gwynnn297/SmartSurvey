package vn.duytan.c1se09.smartsurvey.domain.response.question;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class QuestionReorderResponseDTO {
    private Long surveyId;
    private String message;
} 