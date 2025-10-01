package vn.duytan.c1se09.smartsurvey.domain.request.response;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class ResponseSubmitRequestDTO {
	@NotNull(message = "surveyId không được trống")
	private Long surveyId;

	private String requestToken;

	@Valid
	@NotNull(message = "answers không được trống")
	private List<AnswerSubmitDTO> answers;
}