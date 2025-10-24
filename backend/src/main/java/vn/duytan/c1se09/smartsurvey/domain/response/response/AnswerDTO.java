package vn.duytan.c1se09.smartsurvey.domain.response.response;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class AnswerDTO {
    private Long answerId;
    private Long questionId;
    private Long optionId; // For single choice
    private List<Long> selectedOptionIds; // For multiple choice - always IDs for consistent API
    private String answerText;
    private LocalDateTime createdAt;
    private String questionText;

    // For ranking questions
    private List<String> rankingOrder;

    // For date/time questions
    private String dateValue;
    private String timeValue;
}