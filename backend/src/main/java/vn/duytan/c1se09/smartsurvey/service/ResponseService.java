package vn.duytan.c1se09.smartsurvey.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.duytan.c1se09.smartsurvey.domain.*;
import vn.duytan.c1se09.smartsurvey.domain.request.response.AnswerSubmitDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.response.ResponseSubmitRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.response.AnswerDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.response.ResponseWithAnswersDTO;
import vn.duytan.c1se09.smartsurvey.repository.*;
import vn.duytan.c1se09.smartsurvey.util.constant.QuestionTypeEnum;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ResponseService {
	private final ResponseRepository responseRepository;
	private final AnswerRepository answerRepository;
	private final SurveyRepository surveyRepository;
	private final QuestionRepository questionRepository;
	private final OptionRepository optionRepository;

	private final AuthService authService;
	private final ActivityLogService activityLogService;

	@Transactional
	public ResponseWithAnswersDTO submitResponse(ResponseSubmitRequestDTO request) throws IdInvalidException {
		Survey survey = surveyRepository.findById(request.getSurveyId())
				.orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));

		List<Question> questions = questionRepository.findBySurvey(survey);
		if (questions.isEmpty()) {
			throw new IdInvalidException("Khảo sát chưa có câu hỏi");
		}

		Map<Long, Question> questionById = questions.stream()
				.collect(Collectors.toMap(Question::getQuestionId, q -> q));

		Map<Long, List<AnswerSubmitDTO>> answersByQuestion = request.getAnswers().stream()
				.collect(Collectors.groupingBy(AnswerSubmitDTO::getQuestionId));

		for (Question q : questions) {
			if (Boolean.TRUE.equals(q.getIsRequired())) {
				List<AnswerSubmitDTO> provided = answersByQuestion.getOrDefault(q.getQuestionId(), Collections.emptyList());
				if (provided.isEmpty() || !isValidProvidedForType(q, provided)) {
					throw new IdInvalidException("Thiếu câu trả lời cho câu hỏi bắt buộc: " + q.getQuestionId());
				}
			}
		}

		Response response = new Response();
		response.setSurvey(survey);

		User current = tryGetCurrentUserOrNull();
		if (current != null) {
			response.setUser(current);
		}
		if (request.getRequestToken() != null && !request.getRequestToken().isBlank()) {
			response.setRequestToken(request.getRequestToken().trim());
		}

		Response savedResponse = responseRepository.save(response);

		List<Answer> toSave = new ArrayList<>();
		for (AnswerSubmitDTO dto : request.getAnswers()) {
			Question question = questionById.get(dto.getQuestionId());
			if (question == null) {
				throw new IdInvalidException("questionId không thuộc khảo sát: " + dto.getQuestionId());
			}
			validateSingleAnswer(question, dto);

			Answer answer = new Answer();
			answer.setResponse(savedResponse);
			answer.setQuestion(question);

			if (dto.getOptionId() != null) {
				Option option = optionRepository.findById(dto.getOptionId())
						.orElseThrow(() -> new IdInvalidException("Không tìm thấy optionId: " + dto.getOptionId()));
				if (!option.getQuestion().getQuestionId().equals(question.getQuestionId())) {
					throw new IdInvalidException("option không thuộc câu hỏi");
				}
				answer.setOption(option);
			}
			if (dto.getAnswerText() != null) {
				answer.setAnswerText(dto.getAnswerText());
			}
			toSave.add(answer);
		}
		List<Answer> savedAnswers = answerRepository.saveAll(toSave);

		activityLogService.log(
				ActivityLog.ActionType.submit_response,
				savedResponse.getResponseId(),
				"responses",
				"Gửi phản hồi cho survey " + survey.getSurveyId()
		);

		ResponseWithAnswersDTO dto = new ResponseWithAnswersDTO();
		dto.setResponseId(savedResponse.getResponseId());
		dto.setSurveyId(survey.getSurveyId());
		dto.setUserId(savedResponse.getUser() != null ? savedResponse.getUser().getUserId() : null);
		dto.setRequestToken(savedResponse.getRequestToken());
		dto.setSubmittedAt(savedResponse.getSubmittedAt());
		dto.setAnswers(savedAnswers.stream().map(a -> {
			AnswerDTO ad = new AnswerDTO();
			ad.setAnswerId(a.getAnswerId());
			ad.setQuestionId(a.getQuestion().getQuestionId());
			ad.setOptionId(a.getOption() != null ? a.getOption().getOptionId() : null);
			ad.setAnswerText(a.getAnswerText());
			ad.setCreatedAt(a.getCreatedAt());
            ad.setQuestionText(a.getQuestion().getQuestionText());
			return ad;
		}).toList());
		return dto;
	}

	@Transactional(readOnly = true)
	public List<ResponseWithAnswersDTO> getResponsesBySurvey(Long surveyId) throws IdInvalidException {
		Survey survey = surveyRepository.findById(surveyId)
				.orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));
		List<Response> responses = responseRepository.findBySurvey(survey);
		if (responses.isEmpty()) return List.of();

		return responses.stream().map(r -> {
			ResponseWithAnswersDTO dto = new ResponseWithAnswersDTO();
			dto.setResponseId(r.getResponseId());
			dto.setSurveyId(surveyId);
			dto.setUserId(r.getUser() != null ? r.getUser().getUserId() : null);
			dto.setRequestToken(r.getRequestToken());
			dto.setSubmittedAt(r.getSubmittedAt());

			List<AnswerDTO> answers = answerRepository.findByResponse(r).stream().map(a -> {
				AnswerDTO ad = new AnswerDTO();
				ad.setAnswerId(a.getAnswerId());
				ad.setQuestionId(a.getQuestion().getQuestionId());
				ad.setOptionId(a.getOption() != null ? a.getOption().getOptionId() : null);
				ad.setAnswerText(a.getAnswerText());
				ad.setCreatedAt(a.getCreatedAt());
                ad.setQuestionText(a.getQuestion().getQuestionText());
				return ad;
			}).toList();

			dto.setAnswers(answers);
			return dto;
		}).toList();
	}

	private boolean isValidProvidedForType(Question question, List<AnswerSubmitDTO> provided) {
		QuestionTypeEnum type = question.getQuestionType();
		switch (type) {
			case multiple_choice:
			case boolean_:
				return provided.stream().anyMatch(a -> a.getOptionId() != null
						|| (a.getAnswerText() != null && !a.getAnswerText().isBlank()));
			case open_ended:
			case rating:
				return provided.stream().anyMatch(a -> a.getAnswerText() != null && !a.getAnswerText().isBlank());
			default:
				return false;
		}
	}

	private void validateSingleAnswer(Question question, AnswerSubmitDTO dto) throws IdInvalidException {
		QuestionTypeEnum type = question.getQuestionType();
		switch (type) {
			case multiple_choice:
				if (dto.getOptionId() == null) {
					throw new IdInvalidException("Câu hỏi trắc nghiệm yêu cầu optionId");
				}
				break;
			case boolean_:
				if (dto.getOptionId() == null) {
					if (dto.getAnswerText() == null) {
						throw new IdInvalidException("Câu hỏi đúng/sai yêu cầu optionId hoặc answerText");
					}
					String t = dto.getAnswerText().trim().toLowerCase();
					if (!t.equals("true") && !t.equals("false") && !t.equals("yes") && !t.equals("no")) {
						throw new IdInvalidException("Giá trị đúng/sai không hợp lệ");
					}
				}
				break;
			case open_ended:
				if (dto.getAnswerText() == null || dto.getAnswerText().isBlank()) {
					throw new IdInvalidException("Câu hỏi mở yêu cầu answerText");
				}
				break;
			case rating:
				if (dto.getAnswerText() == null || dto.getAnswerText().isBlank()) {
					throw new IdInvalidException("Câu hỏi đánh giá yêu cầu answerText số");
				}
				try {
					Double.parseDouble(dto.getAnswerText().trim());
				} catch (NumberFormatException ex) {
					throw new IdInvalidException("Giá trị đánh giá phải là số");
				}
				break;
			default:
				throw new IdInvalidException("Loại câu hỏi không hỗ trợ");
		}
	}

	private User tryGetCurrentUserOrNull() {
		try {
			return authService.getCurrentUser();
		} catch (Exception e) {
			return null;
		}
	}
}