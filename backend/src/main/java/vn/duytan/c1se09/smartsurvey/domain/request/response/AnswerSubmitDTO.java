package vn.duytan.c1se09.smartsurvey.domain.request.response;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AnswerSubmitDTO {
	@NotNull(message = "questionId không được trống")
	private Long questionId;

	private Long optionId;

	private String answerText;
}