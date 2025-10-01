package vn.duytan.c1se09.smartsurvey.domain.response.response;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class ResponseWithAnswersDTO {
	private Long responseId;
	private Long surveyId;
	private Long userId;
	private String requestToken;
	private LocalDateTime submittedAt;
	private List<AnswerDTO> answers;
}