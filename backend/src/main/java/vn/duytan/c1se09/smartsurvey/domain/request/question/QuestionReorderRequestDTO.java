package vn.duytan.c1se09.smartsurvey.domain.request.question;

import lombok.Data;
import java.util.List;

@Data
public class QuestionReorderRequestDTO {
	private List<Long> orderedQuestionIds;
} 