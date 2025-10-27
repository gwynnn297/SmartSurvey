package vn.duytan.c1se09.smartsurvey.domain.request.response;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class AnswerSubmitDTO {
	@NotNull(message = "questionId không được trống")
	private Long questionId;

	private Long optionId; // For single choice questions

	private List<Long> selectedOptionIds; // For multiple choice questions (IDs)

	private List<String> selectedOptions; // For multiple choice questions (values)

	private String answerText;

	// For ranking questions
	private List<String> rankingOrder; // Deprecated - for backward compatibility
	private List<Long> rankingOptionIds; // New field - option IDs in ranking order

	// For date/time questions
	private String dateValue;
	private String timeValue;
}