package vn.duytan.c1se09.smartsurvey.domain.response.response;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AnswerDTO {
	private Long answerId;
	private Long questionId;
	private Long optionId;
	private String answerText;
	private LocalDateTime createdAt;
    private String questionText;
}