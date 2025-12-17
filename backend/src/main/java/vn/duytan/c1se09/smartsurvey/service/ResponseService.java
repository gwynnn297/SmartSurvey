package vn.duytan.c1se09.smartsurvey.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.duytan.c1se09.smartsurvey.domain.*;
import vn.duytan.c1se09.smartsurvey.domain.request.response.AnswerSubmitDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.response.ResponseSubmitRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.response.AnswerDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.response.ResponseWithAnswersDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.response.ResponseSummaryDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.response.ResponsePageDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.response.ResponseFilterRequestDTO;
import vn.duytan.c1se09.smartsurvey.repository.*;
import vn.duytan.c1se09.smartsurvey.util.constant.QuestionTypeEnum;
import vn.duytan.c1se09.smartsurvey.util.constant.SurveyStatusEnum;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;
import vn.duytan.c1se09.smartsurvey.util.helper.AnswerDataHelper;

import java.util.*;
import java.util.stream.Collectors;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.beans.factory.annotation.Value;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class ResponseService {
	private final ResponseRepository responseRepository;
	private final AnswerRepository answerRepository;
	private final SurveyRepository surveyRepository;
	private final QuestionRepository questionRepository;
	private final OptionRepository optionRepository;
	private final FileUploadRepository fileUploadRepository;

	private final AuthService authService;
	private final ActivityLogService activityLogService;
	private final AnswerDataHelper answerDataHelper;
	private final SurveyPermissionService surveyPermissionService;

	@Value("${app.upload.dir:uploads}")
	private String uploadDir;

	@Transactional
	public ResponseWithAnswersDTO submitResponse(ResponseSubmitRequestDTO request) throws IdInvalidException {
		Survey survey = surveyRepository.findById(request.getSurveyId())
				.orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));

		// Lấy user hiện tại (có thể null nếu user ngoài)
		User current = tryGetCurrentUserOrNull();
		
		// Kiểm tra quyền trả lời survey:
		// - Chỉ survey published mới cho phép nộp response
		// - Draft và archived KHÔNG CHO PHÉP nộp response (kể cả có permission)
		if (survey.getStatus() != SurveyStatusEnum.published) {
			if (survey.getStatus() == SurveyStatusEnum.draft) {
				throw new IdInvalidException("Khảo sát đang ở trạng thái bản nháp, chưa thể nộp phản hồi");
			} else if (survey.getStatus() == SurveyStatusEnum.archived) {
				throw new IdInvalidException("Khảo sát đã được lưu trữ, không thể nộp phản hồi");
			} else {
				throw new IdInvalidException("Khảo sát không ở trạng thái cho phép nộp phản hồi");
			}
		}
		// Survey published = Public = Ai cũng có thể trả lời (không cần check permission)
		// current có thể null (user ngoài) hoặc có giá trị (user đã đăng nhập)

		List<Question> questions = questionRepository.findBySurvey(survey);
		if (questions.isEmpty()) {
			throw new IdInvalidException("Khảo sát chưa có câu hỏi");
		}

		Map<Long, Question> questionById = questions.stream()
				.collect(Collectors.toMap(Question::getQuestionId, q -> q));

		// Group answers by question for processing (removed unused variable)

		// Bỏ kiểm tra câu hỏi bắt buộc để cho phép submit partial responses
		// Phân loại completed/partial/dropped sẽ được xử lý ở tầng thống kê

		Response response = new Response();
		response.setSurvey(survey);

		// current đã được lấy ở trên khi check permission
		if (current != null) {
			response.setUser(current);
		}
		
		if (request.getRequestToken() != null && !request.getRequestToken().isBlank()) {
			response.setRequestToken(request.getRequestToken().trim());
		}
		
		if (request.getDurationSeconds() != null && request.getDurationSeconds() > 0) {
			response.setDurationSeconds(request.getDurationSeconds());
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

			// Handle different question types
			switch (question.getQuestionType()) {
				case single_choice:
				case boolean_:
				case rating:
					// Single option selection
					if (dto.getOptionId() != null) {
						Option option = optionRepository.findById(dto.getOptionId())
								.orElseThrow(
										() -> new IdInvalidException("Không tìm thấy optionId: " + dto.getOptionId()));
						if (!option.getQuestion().getQuestionId().equals(question.getQuestionId())) {
							throw new IdInvalidException("option không thuộc câu hỏi");
						}
						answer.setOption(option);
					} else if (dto.getAnswerText() != null && !dto.getAnswerText().isBlank()) {
						String text = dto.getAnswerText().trim();
						// Find option from database by text
						List<Option> questionOptions = optionRepository.findByQuestion(question);
						if (questionOptions != null && !questionOptions.isEmpty()) {
							// Try to match provided text to an existing option (case-insensitive)
							Option matched = questionOptions.stream()
									.filter(opt -> opt.getOptionText() != null
											&& opt.getOptionText().equalsIgnoreCase(text))
									.findFirst()
									.orElse(null);
							if (matched != null) {
								answer.setOption(matched);
							} else {
								// Question has options but text doesn't match - reject
								throw new IdInvalidException("Giá trị lựa chọn '" + text + "' không thuộc câu hỏi này");
							}
						} else {
							// No options defined for this question - accept as free text
							answer.setAnswerText(text);
						}
					}
					break;

				case multiple_choice:
					// Multiple option selection - create separate Answer record for each selected option
					List<Long> selectedOptionIds = null;

					if (dto.getSelectedOptionIds() != null && !dto.getSelectedOptionIds().isEmpty()) {
						selectedOptionIds = dto.getSelectedOptionIds();
					} else if (dto.getSelectedOptions() != null && !dto.getSelectedOptions().isEmpty()) {
						// Map text values to option ids - validate they belong to this question
						List<Option> questionOptions = optionRepository.findByQuestion(question);

						if (questionOptions == null || questionOptions.isEmpty()) {
							throw new IdInvalidException("Câu hỏi này không có options để chọn");
						}

						// Build lookup map (case-insensitive)
						Map<String, Option> textToOption = questionOptions.stream()
								.collect(Collectors.toMap(
										opt -> opt.getOptionText().toLowerCase(),
										opt -> opt,
										(existing, replacement) -> existing // handle duplicates
								));

						List<Long> resolvedIds = new ArrayList<>();
						for (String val : dto.getSelectedOptions()) {
							if (val == null)
								continue;
							Option found = textToOption.get(val.toLowerCase());
							if (found == null) {
								throw new IdInvalidException("Lựa chọn '" + val + "' không thuộc câu hỏi này");
							}
							resolvedIds.add(found.getOptionId());
						}
						selectedOptionIds = resolvedIds;
					}

					// Validate all selected option ids belong to this question and create separate Answer records
					if (selectedOptionIds != null && !selectedOptionIds.isEmpty()) {
						for (Long optionId : selectedOptionIds) {
							Option option = optionRepository.findById(optionId)
									.orElseThrow(() -> new IdInvalidException("Không tìm thấy optionId: " + optionId));
							if (!option.getQuestion().getQuestionId().equals(question.getQuestionId())) {
								throw new IdInvalidException("option không thuộc câu hỏi");
							}

							// Create separate Answer record for each selected option
							Answer multipleChoiceAnswer = new Answer();
							multipleChoiceAnswer.setResponse(savedResponse);
							multipleChoiceAnswer.setQuestion(question);
							multipleChoiceAnswer.setOption(option); // Store the selected option
							// No need to set answer_text for multiple choice with option selection
							toSave.add(multipleChoiceAnswer);
						}
						// Skip creating the main answer since we created individual records
						continue;
					}
					break;

				case ranking:
					// Ranking question - store as multiple Answer records with option_id and rank
					if (dto.getRankingOptionIds() != null && !dto.getRankingOptionIds().isEmpty()) {
						// Create separate Answer record for each ranked option
						for (int i = 0; i < dto.getRankingOptionIds().size(); i++) {
							Long optionId = dto.getRankingOptionIds().get(i);
							int rank = i + 1; // Rank starts from 1
							
							Option option = optionRepository.findById(optionId)
									.orElseThrow(() -> new IdInvalidException("Không tìm thấy optionId: " + optionId));
							
							Answer rankingAnswer = new Answer();
							rankingAnswer.setResponse(savedResponse);
							rankingAnswer.setQuestion(question);
							rankingAnswer.setOption(option); // Store the option
							rankingAnswer.setAnswerText(String.valueOf(rank)); // Store rank as answer_text
							toSave.add(rankingAnswer);
						}
						// Skip creating the main answer since we created individual records
						continue;
					} else if (dto.getRankingOrder() != null && !dto.getRankingOrder().isEmpty()) {
						// Legacy: store order as JSON string
						answer.setAnswerText(answerDataHelper.serializeRankingOrder(dto.getRankingOrder()));
					} else if (dto.getAnswerText() != null && !dto.getAnswerText().isBlank()) {
						// Advanced ranking with JSON answerText
						answer.setAnswerText(dto.getAnswerText());
					}
					break;

				case date_time:
					// Date/time question
					if (dto.getDateValue() != null || dto.getTimeValue() != null) {
						StringBuilder dateTimeData = new StringBuilder();
						if (dto.getDateValue() != null) {
							dateTimeData.append("date:").append(dto.getDateValue());
						}
						if (dto.getTimeValue() != null) {
							dateTimeData.append(";time:").append(dto.getTimeValue());
						}
						answer.setAnswerText(dateTimeData.toString());
					} else if (dto.getAnswerText() != null && !dto.getAnswerText().isBlank()) {
						// Advanced date/time with ISO string answerText
						answer.setAnswerText(dto.getAnswerText());
					}
					break;

				case open_ended:
				case file_upload:
				default:
					// Text-based answers
					if (dto.getAnswerText() != null) {
						answer.setAnswerText(dto.getAnswerText());
					}
					break;
			}
			toSave.add(answer);
		}
		List<Answer> savedAnswers = answerRepository.saveAll(toSave);

		activityLogService.log(
				ActivityLog.ActionType.submit_response,
				savedResponse.getResponseId(),
				"responses",
				"Gửi phản hồi cho survey " + survey.getSurveyId());

		ResponseWithAnswersDTO dto = new ResponseWithAnswersDTO();
		dto.setResponseId(savedResponse.getResponseId());
		dto.setSurveyId(survey.getSurveyId());
		dto.setUserId(savedResponse.getUser() != null ? savedResponse.getUser().getUserId() : null);
		dto.setRequestToken(savedResponse.getRequestToken());
		dto.setSubmittedAt(savedResponse.getSubmittedAt());
		
		// Group answers by question for multiple choice handling  
		Map<Long, List<Answer>> submitAnswersByQuestion = savedAnswers.stream()
				.collect(Collectors.groupingBy(a -> a.getQuestion().getQuestionId()));

		List<AnswerDTO> answerDTOs = new ArrayList<>();
		
		for (Map.Entry<Long, List<Answer>> entry : submitAnswersByQuestion.entrySet()) {
			Long questionId = entry.getKey();
			List<Answer> questionAnswers = entry.getValue();
			
			if (questionAnswers.isEmpty()) continue;
			
			Answer firstAnswer = questionAnswers.get(0);
			Question question = firstAnswer.getQuestion();
			
			AnswerDTO ad = new AnswerDTO();
			ad.setQuestionId(questionId);
			ad.setQuestionText(question.getQuestionText());
			ad.setCreatedAt(firstAnswer.getCreatedAt());
			
			// Handle different question types
			if (question.getQuestionType() == QuestionTypeEnum.multiple_choice) {
				// For multiple choice: collect all selected option IDs from multiple Answer records
				List<Long> selectedOptionIds = questionAnswers.stream()
						.filter(a -> a.getOption() != null)
						.map(a -> a.getOption().getOptionId())
						.distinct()
						.toList();
				
				ad.setSelectedOptionIds(selectedOptionIds);
				ad.setAnswerId(firstAnswer.getAnswerId()); // Use first answer's ID as representative
				// Don't set optionId or answerText for multiple choice
			} else if (question.getQuestionType() == QuestionTypeEnum.ranking) {
				// For ranking: handle both new and legacy formats
				processRankingAnswer(questionAnswers, ad);
			} else {
				// For single choice and other types: use the single Answer record
				ad.setAnswerId(firstAnswer.getAnswerId());
				ad.setOptionId(firstAnswer.getOption() != null ? firstAnswer.getOption().getOptionId() : null);
				ad.setAnswerText(firstAnswer.getAnswerText());
				
				// Parse special answer formats
				if (firstAnswer.getAnswerText() != null && question.getQuestionType() != null) {
					switch (question.getQuestionType()) {
						case date_time:
							parseDateTimeAnswer(firstAnswer.getAnswerText(), ad);
							break;
						case file_upload:
							// For file upload questions, get uploaded files info
							List<FileUpload> files = fileUploadRepository.findByAnswer(firstAnswer);
							if (!files.isEmpty()) {
								List<AnswerDTO.FileUploadInfo> fileInfos = files.stream()
										.map(this::mapToFileUploadInfo)
										.toList();
								ad.setUploadedFiles(fileInfos);
							}
							break;
						default:
							break;
					}
				}
			}
			
			// For file upload questions: always load file info regardless of other conditions
			if (question.getQuestionType() == QuestionTypeEnum.file_upload) {
				List<FileUpload> files = fileUploadRepository.findByAnswer(firstAnswer);
				if (!files.isEmpty()) {
					List<AnswerDTO.FileUploadInfo> fileInfos = files.stream()
							.map(this::mapToFileUploadInfo)
							.toList();
					ad.setUploadedFiles(fileInfos);
					// Clear the "File uploaded successfully" message since we have the actual file info
					if (ad.getAnswerText() != null && ad.getAnswerText().startsWith("File uploaded successfully")) {
						ad.setAnswerText(null);
					}
				}
			}
			
			answerDTOs.add(ad);
		}

		dto.setAnswers(answerDTOs);
		return dto;
	}

    @Transactional(readOnly = true)
    public List<ResponseWithAnswersDTO> getResponsesBySurvey(Long surveyId) throws IdInvalidException {
		Survey survey = surveyRepository.findById(surveyId)
				.orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));
		List<Response> responses = responseRepository.findBySurvey(survey);
		if (responses.isEmpty())
			return List.of();

		return responses.stream().map(r -> {
			ResponseWithAnswersDTO dto = new ResponseWithAnswersDTO();
			dto.setResponseId(r.getResponseId());
			dto.setSurveyId(surveyId);
			dto.setUserId(r.getUser() != null ? r.getUser().getUserId() : null);
			dto.setRequestToken(r.getRequestToken());
			dto.setSubmittedAt(r.getSubmittedAt());

			// Get all answers for this response
			List<Answer> allAnswers = answerRepository.findByResponse(r);
			
			// Group answers by question for multiple choice handling
			Map<Long, List<Answer>> answersByQuestion = allAnswers.stream()
					.collect(Collectors.groupingBy(a -> a.getQuestion().getQuestionId()));

			List<AnswerDTO> answers = new ArrayList<>();
			
			for (Map.Entry<Long, List<Answer>> entry : answersByQuestion.entrySet()) {
				Long questionId = entry.getKey();
				List<Answer> questionAnswers = entry.getValue();
				
				if (questionAnswers.isEmpty()) continue;
				
				Answer firstAnswer = questionAnswers.get(0);
				Question question = firstAnswer.getQuestion();
				
				AnswerDTO ad = new AnswerDTO();
				ad.setQuestionId(questionId);
				ad.setQuestionText(question.getQuestionText());
				ad.setCreatedAt(firstAnswer.getCreatedAt());
				
				// Handle different question types
				if (question.getQuestionType() == QuestionTypeEnum.multiple_choice) {
					// For multiple choice: collect all selected option IDs from multiple Answer records
					List<Long> selectedOptionIds = questionAnswers.stream()
							.filter(a -> a.getOption() != null)
							.map(a -> a.getOption().getOptionId())
							.distinct()
							.toList();
					
					ad.setSelectedOptionIds(selectedOptionIds);
					ad.setAnswerId(firstAnswer.getAnswerId()); // Use first answer's ID as representative
					// Don't set optionId or answerText for multiple choice
				} else {
					// For single choice and other types: use the single Answer record
					ad.setAnswerId(firstAnswer.getAnswerId());
					ad.setOptionId(firstAnswer.getOption() != null ? firstAnswer.getOption().getOptionId() : null);
					ad.setAnswerText(firstAnswer.getAnswerText());
				}
				
				answers.add(ad);
			}

			dto.setAnswers(answers);
			return dto;
		}).toList();
	}

	@Transactional(readOnly = true)
	public ResponsePageDTO<ResponseSummaryDTO> listResponses(Long surveyId, ResponseFilterRequestDTO filter) throws IdInvalidException {
		Survey survey = surveyRepository.findById(surveyId)
				.orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));

		User currentUser = authService.getCurrentUser();
		if (!surveyPermissionService.canViewResults(survey, currentUser)) {
			throw new IdInvalidException("Bạn không có quyền xem kết quả khảo sát này");
		}

		org.springframework.data.domain.Pageable pageable = buildPageable(filter.getPage(), filter.getSize(), filter.getSort());

		var page = responseRepository.findPageBySurveyWithFilters(
				survey,
				filter.getFrom(),
				filter.getTo(),
				filter.getUserId(),
				filter.getRequestToken() != null && !filter.getRequestToken().isBlank() ? filter.getRequestToken() : null,
				filter.getSearch() != null && !filter.getSearch().isBlank() ? filter.getSearch() : null,
				filter.getCompletionStatus() != null && !filter.getCompletionStatus().isBlank() ? filter.getCompletionStatus() : null,
				pageable
		);

		List<Question> requiredQuestions = questionRepository.findBySurveyAndIsRequiredTrue(survey);

		List<ResponseSummaryDTO> items = page.getContent().stream().map(r -> {
			String status = determineCompletionStatus(r, requiredQuestions);
			return ResponseSummaryDTO.builder()
					.responseId(r.getResponseId())
					.surveyId(surveyId)
					.userId(r.getUser() != null ? r.getUser().getUserId() : null)
					.requestToken(r.getRequestToken())
					.submittedAt(r.getSubmittedAt())
					.durationSeconds(r.getDurationSeconds())
					.completionStatus(status)
					.build();
		}).toList();

		ResponsePageDTO<ResponseSummaryDTO> dto = new ResponsePageDTO<>();
		ResponsePageDTO.Meta meta = new ResponsePageDTO.Meta();
		meta.setPage(page.getNumber());
		meta.setPageSize(page.getSize());
		meta.setPages(page.getTotalPages());
		meta.setTotal(page.getTotalElements());
		dto.setMeta(meta);
		dto.setResult(items);
		return dto;
	}

	@Transactional(readOnly = true)
	public ResponseWithAnswersDTO getResponseDetail(Long responseId) throws IdInvalidException {
		Response response = responseRepository.findById(responseId)
				.orElseThrow(() -> new IdInvalidException("Không tìm thấy response"));

		User currentUser = authService.getCurrentUser();
		if (!surveyPermissionService.canViewResults(response.getSurvey(), currentUser)) {
			throw new IdInvalidException("Bạn không có quyền xem response này");
		}

		return buildResponseWithAnswersDTO(response);
	}

	@Transactional(readOnly = true)
	public org.springframework.http.ResponseEntity<byte[]> exportResponses(Long surveyId, ResponseFilterRequestDTO filter, String format, boolean includeAnswers) throws IdInvalidException {
		Survey survey = surveyRepository.findById(surveyId)
				.orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));

		User currentUser = authService.getCurrentUser();
		if (!surveyPermissionService.canViewResults(survey, currentUser)) {
			throw new IdInvalidException("Bạn không có quyền export responses của khảo sát này");
		}

		// Fetch all (no pagination) with filters
		org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(0, Integer.MAX_VALUE);
		var page = responseRepository.findPageBySurveyWithFilters(
				survey,
				filter.getFrom(),
				filter.getTo(),
				filter.getUserId(),
				filter.getRequestToken(),
				filter.getSearch(),
				filter.getCompletionStatus(),
				pageable);

		List<Response> responses = page.getContent();
		// Lấy tất cả questions và sắp xếp theo displayOrder
		List<Question> allQuestions = questionRepository.findBySurveyOrderByDisplayOrderAsc(survey);

		if ("xlsx".equalsIgnoreCase(format)) {
			byte[] bytes = exportXlsx(survey, responses, includeAnswers, allQuestions);
			return buildDownload(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "responses_" + surveyId + ".xlsx");
		}
		// default CSV
		byte[] bytes = exportCsv(survey, responses, includeAnswers, allQuestions);
		return buildDownload(bytes, "text/csv; charset=UTF-8", "responses_" + surveyId + ".csv");
	}

	@Transactional
	public int bulkDelete(Long surveyId, List<Long> responseIds) throws IdInvalidException {
		Survey survey = surveyRepository.findById(surveyId)
				.orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));
		User currentUser = authService.getCurrentUser();
		if (!surveyPermissionService.canDelete(survey, currentUser)) {
			throw new IdInvalidException("Chỉ chủ sở hữu mới có quyền xóa responses");
		}

		int deleted = 0;
		for (Long id : responseIds) {
			Response r = responseRepository.findById(id).orElse(null);
			if (r == null) continue;
			if (!r.getSurvey().getSurveyId().equals(surveyId)) continue;
			// delete answers first (cascade might handle, but do explicitly)
			List<Answer> answers = answerRepository.findByResponse(r);
			answerRepository.deleteAll(answers);
			responseRepository.delete(r);
			deleted++;
		}
		return deleted;
	}

	private org.springframework.data.domain.Pageable buildPageable(Integer page, Integer size, String sort) {
		int p = page != null && page >= 0 ? page : 0;
		int s = size != null && size > 0 ? size : 10;
		org.springframework.data.domain.Sort sortSpec = org.springframework.data.domain.Sort.by("submittedAt").descending();
		if (sort != null && !sort.isBlank()) {
			String[] parts = sort.split(",");
			String field = parts[0];
			boolean asc = parts.length < 2 || !"desc".equalsIgnoreCase(parts[1]);
			sortSpec = asc ? org.springframework.data.domain.Sort.by(field).ascending() : org.springframework.data.domain.Sort.by(field).descending();
		}
		return org.springframework.data.domain.PageRequest.of(p, s, sortSpec);
	}

	private String determineCompletionStatus(Response r, List<Question> requiredQuestions) {
		List<Answer> answers = answerRepository.findByResponse(r);
		if (answers.isEmpty()) return "dropped";
		Set<Long> answeredRequired = answers.stream()
				.filter(a -> a.getQuestion() != null && Boolean.TRUE.equals(a.getQuestion().getIsRequired()))
				.map(a -> a.getQuestion().getQuestionId())
				.collect(java.util.stream.Collectors.toSet());
		long requiredCount = requiredQuestions.stream().filter(q -> Boolean.TRUE.equals(q.getIsRequired())).count();
		return answeredRequired.size() >= requiredCount && requiredCount > 0 ? "completed" : "partial";
	}

	private byte[] exportCsv(Survey survey, List<Response> responses, boolean includeAnswers, List<Question> questions) {
		StringBuilder sb = new StringBuilder();
		
		// Thêm UTF-8 BOM để Excel hiểu đúng tiếng Việt
		sb.append("\uFEFF");
		
		// ========== PHẦN 1: TỔNG QUAN ==========
		sb.append("BÁO CÁO PHẢN HỒI KHẢO SÁT\r\n");
		sb.append("========================================\r\n");
		sb.append("\r\n");
		
		// Thông tin khảo sát
		sb.append("Thông tin khảo sát:\r\n");
		sb.append("Tên khảo sát:,").append(escapeCsv(survey.getTitle() != null ? survey.getTitle() : "N/A")).append("\r\n");
		sb.append("ID khảo sát:,").append(survey.getSurveyId()).append("\r\n");
		if (survey.getCreatedAt() != null) {
			sb.append("Ngày tạo:,").append(escapeCsv(survey.getCreatedAt().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")))).append("\r\n");
		}
		if (survey.getStatus() != null) {
			sb.append("Trạng thái:,").append(escapeCsv(survey.getStatus().name())).append("\r\n");
		}
		sb.append("\r\n");
		
		// Tính toán thống kê
		int totalResponses = responses.size();
		List<Question> requiredQuestions = questions.stream()
				.filter(q -> Boolean.TRUE.equals(q.getIsRequired()))
				.collect(Collectors.toList());
		
		int completed = 0;
		int partial = 0;
		int dropped = 0;
		
		for (Response r : responses) {
			String status = determineCompletionStatus(r, requiredQuestions);
			if (status.equals("completed")) {
				completed++;
			} else if (status.equals("partial")) {
				partial++;
			} else {
				dropped++;
			}
		}
		
		double completionRate = totalResponses > 0 ? (double) completed / totalResponses * 100 : 0.0;
		
		double avgDuration = 0.0;
		int countWithDuration = 0;
		for (Response r : responses) {
			if (r.getDurationSeconds() != null && r.getDurationSeconds() > 0) {
				avgDuration += r.getDurationSeconds();
				countWithDuration++;
			}
		}
		if (countWithDuration > 0) {
			avgDuration = avgDuration / countWithDuration;
		}
		String avgTimeStr = formatDuration((int) avgDuration);
		
		LocalDateTime firstResponse = null;
		LocalDateTime lastResponse = null;
		for (Response r : responses) {
			if (r.getSubmittedAt() != null) {
				if (firstResponse == null || r.getSubmittedAt().isBefore(firstResponse)) {
					firstResponse = r.getSubmittedAt();
				}
				if (lastResponse == null || r.getSubmittedAt().isAfter(lastResponse)) {
					lastResponse = r.getSubmittedAt();
				}
			}
		}
		
		// Thống kê phản hồi
		sb.append("Thống kê phản hồi:\r\n");
		sb.append("Tổng số phản hồi:,").append(totalResponses).append("\r\n");
		sb.append("Số phản hồi hoàn thành:,").append(completed).append("\r\n");
		sb.append("Số phản hồi chưa hoàn thành:,").append(partial).append("\r\n");
		sb.append("Số phản hồi bỏ dở:,").append(dropped).append("\r\n");
		sb.append("Tỷ lệ hoàn thành:,").append(String.format("%.2f%%", completionRate)).append("\r\n");
		sb.append("Thời gian trung bình hoàn thành:,").append(escapeCsv(avgTimeStr)).append("\r\n");
		if (firstResponse != null) {
			sb.append("Phản hồi đầu tiên:,").append(escapeCsv(firstResponse.format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")))).append("\r\n");
		}
		if (lastResponse != null) {
			sb.append("Phản hồi cuối cùng:,").append(escapeCsv(lastResponse.format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")))).append("\r\n");
		}
		sb.append("\r\n");
		
		// Thống kê câu hỏi
		sb.append("Thống kê câu hỏi:\r\n");
		sb.append("Tổng số câu hỏi:,").append(questions.size()).append("\r\n");
		sb.append("Số câu hỏi bắt buộc:,").append(requiredQuestions.size()).append("\r\n");
		sb.append("Số câu hỏi tùy chọn:,").append(questions.size() - requiredQuestions.size()).append("\r\n");
		sb.append("\r\n");
		
		// ========== PHẦN 2: THỐNG KÊ TỪNG CÂU HỎI ==========
		sb.append("THỐNG KÊ TỪNG CÂU HỎI\r\n");
		sb.append("========================================\r\n");
		sb.append("STT,Câu hỏi,Số người trả lời,Tỷ lệ (%),Loại câu hỏi\r\n");
		
		int stt = 1;
		for (Question question : questions) {
			// Đếm số người trả lời
			int answerCount = 0;
			for (Response response : responses) {
				List<Answer> answers = answerRepository.findByResponse(response);
				boolean hasAnswer = answers.stream()
						.anyMatch(a -> a.getQuestion() != null && 
								a.getQuestion().getQuestionId().equals(question.getQuestionId()));
				if (hasAnswer) {
					answerCount++;
				}
			}
			
			double percentage = totalResponses > 0 ? (double) answerCount / totalResponses * 100 : 0.0;
			String questionText = question.getQuestionText() != null ? question.getQuestionText() : "Câu hỏi " + question.getQuestionId();
			String questionType = question.getQuestionType() != null ? 
					translateQuestionType(question.getQuestionType()) : "N/A";
			
			sb.append(stt++).append(',')
					.append(escapeCsv(questionText)).append(',')
					.append(answerCount).append(',')
					.append(String.format("%.2f", percentage)).append(',')
					.append(escapeCsv(questionType)).append("\r\n");
		}
		
		sb.append("TỔNG CỘNG,,").append(totalResponses).append(",100.00,\r\n");
		sb.append("\r\n");
		sb.append("\r\n");
		
		// ========== PHẦN 2.5: THỐNG KÊ CHI TIẾT TỪNG CÂU HỎI (ĐÁP ÁN VÀ SỐ LƯỢNG) ==========
		sb.append("THỐNG KÊ CHI TIẾT TỪNG CÂU HỎI - ĐÁP ÁN VÀ SỐ LƯỢNG\r\n");
		sb.append("========================================\r\n");
		sb.append("\r\n");
		
		for (Question question : questions) {
			String questionText = question.getQuestionText() != null ? question.getQuestionText() : "Câu hỏi " + question.getQuestionId();
			sb.append("Câu hỏi: ").append(escapeCsv(questionText)).append("\r\n");
			sb.append("Tùy chọn,Số lượng,Tỷ lệ (%),Loại câu hỏi\r\n");
			
			QuestionTypeEnum questionType = question.getQuestionType();
			
			if (questionType == QuestionTypeEnum.multiple_choice || 
				questionType == QuestionTypeEnum.single_choice ||
				questionType == QuestionTypeEnum.boolean_ ||
				questionType == QuestionTypeEnum.rating) {
				// Câu hỏi có options
				List<Option> options = optionRepository.findByQuestionOrderByCreatedAt(question);
				List<Answer> allAnswers = answerRepository.findByQuestion(question);
				
				// Đếm số lượng cho mỗi option
				Map<Long, Integer> optionCounts = new HashMap<>();
				for (Answer answer : allAnswers) {
					if (answer.getOption() != null) {
						Long optionId = answer.getOption().getOptionId();
						optionCounts.put(optionId, optionCounts.getOrDefault(optionId, 0) + 1);
					}
				}
				
				// Tính tổng số responses cho câu hỏi này
				int questionTotalResponses = (int) allAnswers.stream()
						.map(a -> a.getResponse().getResponseId())
						.distinct()
						.count();
				
				// Hiển thị từng option
				for (Option option : options) {
					int count = optionCounts.getOrDefault(option.getOptionId(), 0);
					double percentage = questionTotalResponses > 0 ? (double) count / questionTotalResponses * 100 : 0.0;
					
					sb.append(escapeCsv(option.getOptionText() != null ? option.getOptionText() : "N/A")).append(',')
							.append(count).append(',')
							.append(String.format("%.2f", percentage)).append(',')
							.append(escapeCsv(translateQuestionType(questionType))).append("\r\n");
				}
				
				// Tổng cộng
				sb.append("Tổng,").append(questionTotalResponses).append(",100.00,\r\n");
				
			} else if (questionType == QuestionTypeEnum.open_ended) {
				// Câu hỏi mở
				List<Answer> allAnswers = answerRepository.findByQuestion(question);
				int answerCount = (int) allAnswers.stream()
						.filter(a -> a.getAnswerText() != null && !a.getAnswerText().trim().isEmpty())
						.map(a -> a.getResponse().getResponseId())
						.distinct()
						.count();
				
				double percentage = totalResponses > 0 ? (double) answerCount / totalResponses * 100 : 0.0;
				sb.append("Câu hỏi mở,").append(answerCount).append(',')
						.append(String.format("%.2f", percentage)).append(',')
						.append(escapeCsv(translateQuestionType(questionType))).append("\r\n");
			} else {
				// Các loại câu hỏi khác
				List<Answer> allAnswers = answerRepository.findByQuestion(question);
				int answerCount = (int) allAnswers.stream()
						.map(a -> a.getResponse().getResponseId())
						.distinct()
						.count();
				
				double percentage = totalResponses > 0 ? (double) answerCount / totalResponses * 100 : 0.0;
				sb.append("Có trả lời,").append(answerCount).append(',')
						.append(String.format("%.2f", percentage)).append(',')
						.append(escapeCsv(translateQuestionType(questionType))).append("\r\n");
			}
			
			sb.append("\r\n"); // Skip một dòng giữa các câu hỏi
		}
		
		sb.append("\r\n");
		
		// ========== PHẦN 3: DANH SÁCH PHẢN HỒI ==========
		sb.append("DANH SÁCH PHẢN HỒI\r\n");
		sb.append("========================================\r\n");
		
		// Header với tên cột rõ ràng hơn
		sb.append("STT,Response ID,Survey ID,User ID,Request Token,Submitted At,Duration (seconds),Completion Status");
		if (includeAnswers) {
			for (Question q : questions) {
				sb.append(',').append(escapeCsv(q.getQuestionText() != null ? q.getQuestionText() : ("Q" + q.getQuestionId())));
			}
		}
		sb.append("\r\n"); // Dùng \r\n cho Windows compatibility

		List<Question> required = questions.stream().filter(q -> Boolean.TRUE.equals(q.getIsRequired())).toList();

		stt = 1;
		for (Response r : responses) {
			String status = determineCompletionStatus(r, required);
			String statusVi = status.equals("completed") ? "Hoàn thành" : 
							  status.equals("partial") ? "Chưa hoàn thành" : "Bỏ dở";
			
			// Format submittedAt đúng chuẩn
			String submittedAtStr = r.getSubmittedAt() != null 
				? r.getSubmittedAt().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"))
				: "";
			
			sb.append(stt++).append(',')
					.append(r.getResponseId()).append(',')
					.append(r.getSurvey().getSurveyId()).append(',')
					.append(r.getUser() != null ? r.getUser().getUserId() : "").append(',')
					.append(escapeCsv(r.getRequestToken())).append(',')
					.append(escapeCsv(submittedAtStr)).append(',')
					.append(r.getDurationSeconds() != null ? r.getDurationSeconds() : "").append(',')
					.append(escapeCsv(statusVi));
			if (includeAnswers) {
				List<Answer> answers = answerRepository.findByResponse(r);
				Map<Long, List<Answer>> byQ = answers.stream().collect(Collectors.groupingBy(a -> a.getQuestion().getQuestionId()));
				for (Question q : questions) {
					List<Answer> list = byQ.getOrDefault(q.getQuestionId(), List.of());
					String val = formatAnswerValueForCsv(list, q.getQuestionType());
					sb.append(',').append(escapeCsv(val));
				}
			}
			sb.append("\r\n"); // Dùng \r\n
		}
		return sb.toString().getBytes(StandardCharsets.UTF_8);
	}
	
	/**
	 * Format answer value cho CSV (giống với Excel)
	 */
	private String formatAnswerValueForCsv(List<Answer> list, QuestionTypeEnum questionType) {
		if (list == null || list.isEmpty()) {
			return "";
		}
		
		if (questionType == QuestionTypeEnum.multiple_choice || questionType == QuestionTypeEnum.ranking) {
			// Nhiều lựa chọn - nối bằng dấu phẩy
			return list.stream()
					.filter(a -> a.getOption() != null)
					.map(a -> a.getOption().getOptionText())
					.filter(Objects::nonNull)
					.collect(Collectors.joining(", "));
		} else if (questionType == QuestionTypeEnum.single_choice || 
				   questionType == QuestionTypeEnum.boolean_ || 
				   questionType == QuestionTypeEnum.rating) {
			Answer a = list.get(0);
			if (a == null) return "";
			if (a.getOption() != null && a.getOption().getOptionText() != null) {
				return a.getOption().getOptionText();
			}
			return a.getAnswerText() != null ? a.getAnswerText() : "";
		} else {
			// Open-ended, date_time, file_upload, etc.
			Answer a = list.get(0);
			return a != null && a.getAnswerText() != null ? a.getAnswerText() : "";
		}
	}

	private byte[] exportXlsx(Survey survey, List<Response> responses, boolean includeAnswers, List<Question> questions) {
		try {
			org.apache.poi.xssf.usermodel.XSSFWorkbook wb = new org.apache.poi.xssf.usermodel.XSSFWorkbook();
			
			// Sắp xếp questions theo displayOrder
			List<Question> sortedQuestions = new ArrayList<>(questions);
			sortedQuestions.sort((q1, q2) -> {
				Integer order1 = q1.getDisplayOrder() != null ? q1.getDisplayOrder() : 0;
				Integer order2 = q2.getDisplayOrder() != null ? q2.getDisplayOrder() : 0;
				return Integer.compare(order1, order2);
			});
			
			// Tạo các style
			org.apache.poi.ss.usermodel.CellStyle headerStyle = createHeaderStyle(wb);
			org.apache.poi.ss.usermodel.CellStyle dataStyle = createDataStyle(wb);
			org.apache.poi.ss.usermodel.CellStyle dateStyle = createDateStyle(wb);
			org.apache.poi.ss.usermodel.CellStyle numberStyle = createNumberStyle(wb);
			org.apache.poi.ss.usermodel.CellStyle titleStyle = createTitleStyle(wb);
			org.apache.poi.ss.usermodel.CellStyle completedStyle = createStatusStyle(wb, true);
			org.apache.poi.ss.usermodel.CellStyle partialStyle = createStatusStyle(wb, false);
			
			// Sheet 1: Tổng quan
			createOverviewSheet(wb, survey, responses, sortedQuestions, titleStyle, dataStyle, numberStyle);
			
			// Sheet 2: Thống kê câu hỏi
			createQuestionStatsSheet(wb, survey, responses, sortedQuestions, headerStyle, dataStyle, numberStyle);
			
			// Sheet 3: Thống kê chi tiết từng câu hỏi (đáp án và số lượng)
			createDetailedQuestionStatsSheet(wb, survey, responses, sortedQuestions, headerStyle, dataStyle, numberStyle);
			
			// Sheet 4: Danh sách phản hồi
			createResponsesSheet(wb, survey, responses, includeAnswers, sortedQuestions, 
					headerStyle, dataStyle, dateStyle, numberStyle, completedStyle, partialStyle);
			
			java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
			wb.write(bos);
			wb.close();
			return bos.toByteArray();
		} catch (Exception e) {
			e.printStackTrace();
			return new byte[0];
		}
	}
	
	/**
	 * Tạo sheet Tổng quan với thống kê đầy đủ
	 */
	private void createOverviewSheet(org.apache.poi.xssf.usermodel.XSSFWorkbook wb, 
			Survey survey, List<Response> responses, List<Question> questions,
			org.apache.poi.ss.usermodel.CellStyle titleStyle,
			org.apache.poi.ss.usermodel.CellStyle dataStyle,
			org.apache.poi.ss.usermodel.CellStyle numberStyle) {
		org.apache.poi.ss.usermodel.Sheet sheet = wb.createSheet("Tổng quan");
		int rowIdx = 0;
		
		// Title
		org.apache.poi.ss.usermodel.Row titleRow = sheet.createRow(rowIdx++);
		org.apache.poi.ss.usermodel.Cell titleCell = titleRow.createCell(0);
		titleCell.setCellValue("BÁO CÁO PHẢN HỒI KHẢO SÁT");
		titleCell.setCellStyle(titleStyle);
		sheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(0, 0, 0, 1));
		
		rowIdx++; // Skip một dòng
		
		// Thông tin survey
		addInfoRow(sheet, rowIdx++, "Tên khảo sát:", 
				survey.getTitle() != null ? survey.getTitle() : "N/A", dataStyle);
		addInfoRow(sheet, rowIdx++, "ID khảo sát:", String.valueOf(survey.getSurveyId()), dataStyle);
		addInfoRow(sheet, rowIdx++, "Ngày tạo:", 
				survey.getCreatedAt() != null 
					? survey.getCreatedAt().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))
					: "N/A", dataStyle);
		addInfoRow(sheet, rowIdx++, "Trạng thái:", 
				survey.getStatus() != null ? survey.getStatus().name() : "N/A", dataStyle);
		
		rowIdx++; // Skip một dòng
		
		// Tính toán thống kê
		int totalResponses = responses.size();
		List<Question> requiredQuestions = questions.stream()
				.filter(q -> Boolean.TRUE.equals(q.getIsRequired()))
				.collect(Collectors.toList());
		
		// Đếm completed, partial, dropped
		int completed = 0;
		int partial = 0;
		int dropped = 0;
		
		for (Response r : responses) {
			String status = determineCompletionStatus(r, requiredQuestions);
			if (status.equals("completed")) {
				completed++;
			} else if (status.equals("partial")) {
				partial++;
			} else {
				dropped++;
			}
		}
		
		// Tính tỷ lệ hoàn thành
		double completionRate = totalResponses > 0 ? (double) completed / totalResponses * 100 : 0.0;
		
		// Tính thời gian trung bình hoàn thành
		double avgDuration = 0.0;
		int countWithDuration = 0;
		for (Response r : responses) {
			if (r.getDurationSeconds() != null && r.getDurationSeconds() > 0) {
				avgDuration += r.getDurationSeconds();
				countWithDuration++;
			}
		}
		if (countWithDuration > 0) {
			avgDuration = avgDuration / countWithDuration;
		}
		String avgTimeStr = formatDuration((int) avgDuration);
		
		// Tìm ngày phản hồi đầu tiên và cuối cùng
		LocalDateTime firstResponse = null;
		LocalDateTime lastResponse = null;
		for (Response r : responses) {
			if (r.getSubmittedAt() != null) {
				if (firstResponse == null || r.getSubmittedAt().isBefore(firstResponse)) {
					firstResponse = r.getSubmittedAt();
				}
				if (lastResponse == null || r.getSubmittedAt().isAfter(lastResponse)) {
					lastResponse = r.getSubmittedAt();
				}
			}
		}
		
		// Thống kê phản hồi
		org.apache.poi.ss.usermodel.Row statsTitleRow = sheet.createRow(rowIdx++);
		org.apache.poi.ss.usermodel.Cell statsTitleCell = statsTitleRow.createCell(0);
		statsTitleCell.setCellValue("THỐNG KÊ PHẢN HỒI");
		org.apache.poi.ss.usermodel.Font statsTitleFont = wb.createFont();
		statsTitleFont.setBold(true);
		statsTitleFont.setFontHeightInPoints((short) 12);
		org.apache.poi.ss.usermodel.CellStyle statsTitleStyle = wb.createCellStyle();
		statsTitleStyle.setFont(statsTitleFont);
		statsTitleCell.setCellStyle(statsTitleStyle);
		sheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(rowIdx - 1, rowIdx - 1, 0, 1));
		
		rowIdx++; // Skip một dòng
		
		// Thống kê số lượng
		addInfoRow(sheet, rowIdx++, "Tổng số phản hồi:", String.valueOf(totalResponses), dataStyle);
		addInfoRowWithNumber(sheet, rowIdx++, "Số phản hồi hoàn thành:", completed, dataStyle, numberStyle);
		addInfoRowWithNumber(sheet, rowIdx++, "Số phản hồi chưa hoàn thành:", partial, dataStyle, numberStyle);
		addInfoRowWithNumber(sheet, rowIdx++, "Số phản hồi bỏ dở:", dropped, dataStyle, numberStyle);
		
		rowIdx++; // Skip một dòng
		
		// Tỷ lệ và thời gian
		addInfoRow(sheet, rowIdx++, "Tỷ lệ hoàn thành:", 
				String.format("%.2f%%", completionRate), dataStyle);
		addInfoRow(sheet, rowIdx++, "Thời gian trung bình hoàn thành:", avgTimeStr, dataStyle);
		
		rowIdx++; // Skip một dòng
		
		// Thông tin thời gian
		if (firstResponse != null) {
			addInfoRow(sheet, rowIdx++, "Phản hồi đầu tiên:", 
					firstResponse.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")), dataStyle);
		}
		if (lastResponse != null) {
			addInfoRow(sheet, rowIdx++, "Phản hồi cuối cùng:", 
					lastResponse.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")), dataStyle);
		}
		
		rowIdx++; // Skip một dòng
		
		// Thống kê câu hỏi
		org.apache.poi.ss.usermodel.Row questionsTitleRow = sheet.createRow(rowIdx++);
		org.apache.poi.ss.usermodel.Cell questionsTitleCell = questionsTitleRow.createCell(0);
		questionsTitleCell.setCellValue("THỐNG KÊ CÂU HỎI");
		questionsTitleCell.setCellStyle(statsTitleStyle);
		sheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(rowIdx - 1, rowIdx - 1, 0, 1));
		
		rowIdx++; // Skip một dòng
		
		addInfoRowWithNumber(sheet, rowIdx++, "Tổng số câu hỏi:", questions.size(), dataStyle, numberStyle);
		addInfoRowWithNumber(sheet, rowIdx++, "Số câu hỏi bắt buộc:", requiredQuestions.size(), dataStyle, numberStyle);
		addInfoRowWithNumber(sheet, rowIdx++, "Số câu hỏi tùy chọn:", 
				questions.size() - requiredQuestions.size(), dataStyle, numberStyle);
		
		// Auto-size columns
		sheet.autoSizeColumn(0);
		sheet.autoSizeColumn(1);
	}
	
	/**
	 * Format thời gian từ giây sang định dạng dễ đọc
	 */
	private String formatDuration(int seconds) {
		if (seconds < 60) {
			return seconds + " giây";
		} else if (seconds < 3600) {
			int minutes = seconds / 60;
			int secs = seconds % 60;
			return minutes + " phút " + secs + " giây";
		} else {
			int hours = seconds / 3600;
			int minutes = (seconds % 3600) / 60;
			int secs = seconds % 60;
			return hours + " giờ " + minutes + " phút " + secs + " giây";
		}
	}
	
	/**
	 * Helper method để thêm một dòng thông tin với số
	 */
	private void addInfoRowWithNumber(org.apache.poi.ss.usermodel.Sheet sheet, int rowIdx, 
			String label, int value, org.apache.poi.ss.usermodel.CellStyle labelStyle,
			org.apache.poi.ss.usermodel.CellStyle numberStyle) {
		org.apache.poi.ss.usermodel.Row row = sheet.createRow(rowIdx);
		row.createCell(0).setCellValue(label);
		row.createCell(1).setCellValue(value);
		row.getCell(0).setCellStyle(labelStyle);
		row.getCell(1).setCellStyle(numberStyle);
	}
	
	/**
	 * Tạo sheet Thống kê câu hỏi
	 */
	private void createQuestionStatsSheet(org.apache.poi.xssf.usermodel.XSSFWorkbook wb,
			Survey survey, List<Response> responses, List<Question> questions,
			org.apache.poi.ss.usermodel.CellStyle headerStyle,
			org.apache.poi.ss.usermodel.CellStyle dataStyle,
			org.apache.poi.ss.usermodel.CellStyle numberStyle) {
		org.apache.poi.ss.usermodel.Sheet sheet = wb.createSheet("Thống kê câu hỏi");
		int rowIdx = 0;
		
		// Title
		org.apache.poi.ss.usermodel.Row titleRow = sheet.createRow(rowIdx++);
		org.apache.poi.ss.usermodel.Cell titleCell = titleRow.createCell(0);
		titleCell.setCellValue("THỐNG KÊ TỪNG CÂU HỎI");
		org.apache.poi.ss.usermodel.Font titleFont = wb.createFont();
		titleFont.setBold(true);
		titleFont.setFontHeightInPoints((short) 14);
		org.apache.poi.ss.usermodel.CellStyle titleStyle = wb.createCellStyle();
		titleStyle.setFont(titleFont);
		titleCell.setCellStyle(titleStyle);
		sheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(0, 0, 0, 4));
		
		rowIdx++; // Skip một dòng
		
		// Header row
		org.apache.poi.ss.usermodel.Row header = sheet.createRow(rowIdx++);
		header.createCell(0).setCellValue("STT");
		header.createCell(1).setCellValue("Câu hỏi");
		header.createCell(2).setCellValue("Số người trả lời");
		header.createCell(3).setCellValue("Tỷ lệ (%)");
		header.createCell(4).setCellValue("Loại câu hỏi");
		
		for (int i = 0; i < 5; i++) {
			header.getCell(i).setCellStyle(headerStyle);
		}
		
		// Tính tổng số responses
		int totalResponses = responses.size();
		
		// Data rows
		int stt = 1;
		for (Question question : questions) {
			org.apache.poi.ss.usermodel.Row row = sheet.createRow(rowIdx++);
			
			// Đếm số người trả lời câu hỏi này
			int answerCount = 0;
			for (Response response : responses) {
				List<Answer> answers = answerRepository.findByResponse(response);
				boolean hasAnswer = answers.stream()
						.anyMatch(a -> a.getQuestion() != null && 
								a.getQuestion().getQuestionId().equals(question.getQuestionId()));
				if (hasAnswer) {
					answerCount++;
				}
			}
			
			// Tính tỷ lệ
			double percentage = totalResponses > 0 ? (double) answerCount / totalResponses * 100 : 0.0;
			
			// STT
			row.createCell(0).setCellValue(stt++);
			row.getCell(0).setCellStyle(numberStyle);
			
			// Câu hỏi
			String questionText = question.getQuestionText() != null ? question.getQuestionText() : "Câu hỏi " + question.getQuestionId();
			row.createCell(1).setCellValue(questionText);
			row.getCell(1).setCellStyle(dataStyle);
			
			// Số người trả lời
			row.createCell(2).setCellValue(answerCount);
			row.getCell(2).setCellStyle(numberStyle);
			
			// Tỷ lệ
			row.createCell(3).setCellValue(percentage);
			org.apache.poi.ss.usermodel.CellStyle percentageStyle = wb.createCellStyle();
			percentageStyle.cloneStyleFrom(numberStyle);
			org.apache.poi.ss.usermodel.CreationHelper createHelper = wb.getCreationHelper();
			percentageStyle.setDataFormat(createHelper.createDataFormat().getFormat("0.00"));
			row.getCell(3).setCellStyle(percentageStyle);
			
			// Loại câu hỏi
			String questionType = question.getQuestionType() != null ? 
					translateQuestionType(question.getQuestionType()) : "N/A";
			row.createCell(4).setCellValue(questionType);
			row.getCell(4).setCellStyle(dataStyle);
		}
		
		rowIdx++; // Skip một dòng
		
		// Tổng cộng
		org.apache.poi.ss.usermodel.Row totalRow = sheet.createRow(rowIdx++);
		totalRow.createCell(0).setCellValue("TỔNG CỘNG");
		totalRow.createCell(1).setCellValue("");
		totalRow.createCell(2).setCellValue(totalResponses);
		totalRow.createCell(3).setCellValue(100.0);
		totalRow.createCell(4).setCellValue("");
		
		for (int i = 0; i < 5; i++) {
			totalRow.getCell(i).setCellStyle(headerStyle);
		}
		
		// Auto-size columns
		for (int i = 0; i < 5; i++) {
			sheet.autoSizeColumn(i);
			int currentWidth = sheet.getColumnWidth(i);
			sheet.setColumnWidth(i, currentWidth + 1000);
			if (sheet.getColumnWidth(i) > 20000) {
				sheet.setColumnWidth(i, 20000);
			}
		}
	}
	
	/**
	 * Tạo sheet Thống kê chi tiết từng câu hỏi (đáp án và số lượng)
	 */
	private void createDetailedQuestionStatsSheet(org.apache.poi.xssf.usermodel.XSSFWorkbook wb,
			Survey survey, List<Response> responses, List<Question> questions,
			org.apache.poi.ss.usermodel.CellStyle headerStyle,
			org.apache.poi.ss.usermodel.CellStyle dataStyle,
			org.apache.poi.ss.usermodel.CellStyle numberStyle) {
		org.apache.poi.ss.usermodel.Sheet sheet = wb.createSheet("Thống kê chi tiết");
		int rowIdx = 0;
		
		// Title
		org.apache.poi.ss.usermodel.Row titleRow = sheet.createRow(rowIdx++);
		org.apache.poi.ss.usermodel.Cell titleCell = titleRow.createCell(0);
		titleCell.setCellValue("THỐNG KÊ CHI TIẾT TỪNG CÂU HỎI - ĐÁP ÁN VÀ SỐ LƯỢNG");
		org.apache.poi.ss.usermodel.Font titleFont = wb.createFont();
		titleFont.setBold(true);
		titleFont.setFontHeightInPoints((short) 14);
		org.apache.poi.ss.usermodel.CellStyle titleStyle = wb.createCellStyle();
		titleStyle.setFont(titleFont);
		titleCell.setCellStyle(titleStyle);
		sheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(0, 0, 0, 3));
		
		rowIdx++; // Skip một dòng
		
		// Tính tổng số responses
		int totalResponses = responses.size();
		
		// Xử lý từng câu hỏi
		for (Question question : questions) {
			// Câu hỏi title
			org.apache.poi.ss.usermodel.Row questionTitleRow = sheet.createRow(rowIdx++);
			org.apache.poi.ss.usermodel.Cell questionTitleCell = questionTitleRow.createCell(0);
			String questionText = question.getQuestionText() != null ? question.getQuestionText() : "Câu hỏi " + question.getQuestionId();
			questionTitleCell.setCellValue(questionText);
			org.apache.poi.ss.usermodel.Font questionFont = wb.createFont();
			questionFont.setBold(true);
			questionFont.setFontHeightInPoints((short) 12);
			org.apache.poi.ss.usermodel.CellStyle questionStyle = wb.createCellStyle();
			questionStyle.setFont(questionFont);
			questionStyle.setFillForegroundColor(org.apache.poi.ss.usermodel.IndexedColors.LIGHT_BLUE.getIndex());
			questionStyle.setFillPattern(org.apache.poi.ss.usermodel.FillPatternType.SOLID_FOREGROUND);
			questionTitleCell.setCellStyle(questionStyle);
			sheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(rowIdx - 1, rowIdx - 1, 0, 3));
			
			// Header cho bảng đáp án
			org.apache.poi.ss.usermodel.Row header = sheet.createRow(rowIdx++);
			header.createCell(0).setCellValue("Tùy chọn");
			header.createCell(1).setCellValue("Số lượng");
			header.createCell(2).setCellValue("Tỷ lệ (%)");
			header.createCell(3).setCellValue("Loại câu hỏi");
			
			for (int i = 0; i < 4; i++) {
				header.getCell(i).setCellStyle(headerStyle);
			}
			
			// Xử lý theo loại câu hỏi
			QuestionTypeEnum questionType = question.getQuestionType();
			
			if (questionType == QuestionTypeEnum.multiple_choice || 
				questionType == QuestionTypeEnum.single_choice ||
				questionType == QuestionTypeEnum.boolean_ ||
				questionType == QuestionTypeEnum.rating) {
				// Câu hỏi có options
				List<Option> options = optionRepository.findByQuestionOrderByCreatedAt(question);
				List<Answer> allAnswers = answerRepository.findByQuestion(question);
				
				// Đếm số lượng cho mỗi option
				Map<Long, Integer> optionCounts = new HashMap<>();
				for (Answer answer : allAnswers) {
					if (answer.getOption() != null) {
						Long optionId = answer.getOption().getOptionId();
						optionCounts.put(optionId, optionCounts.getOrDefault(optionId, 0) + 1);
					}
				}
				
				// Tính tổng số responses cho câu hỏi này (unique responses)
				int questionTotalResponses = (int) allAnswers.stream()
						.map(a -> a.getResponse().getResponseId())
						.distinct()
						.count();
				
				// Hiển thị từng option
				for (Option option : options) {
					org.apache.poi.ss.usermodel.Row row = sheet.createRow(rowIdx++);
					int count = optionCounts.getOrDefault(option.getOptionId(), 0);
					double percentage = questionTotalResponses > 0 ? (double) count / questionTotalResponses * 100 : 0.0;
					
					row.createCell(0).setCellValue(option.getOptionText() != null ? option.getOptionText() : "N/A");
					row.createCell(1).setCellValue(count);
					row.createCell(2).setCellValue(percentage);
					row.createCell(3).setCellValue(translateQuestionType(questionType));
					
					row.getCell(0).setCellStyle(dataStyle);
					row.getCell(1).setCellStyle(numberStyle);
					
					// Format percentage
					org.apache.poi.ss.usermodel.CellStyle percentageStyle = wb.createCellStyle();
					percentageStyle.cloneStyleFrom(numberStyle);
					org.apache.poi.ss.usermodel.CreationHelper createHelper = wb.getCreationHelper();
					percentageStyle.setDataFormat(createHelper.createDataFormat().getFormat("0.00"));
					row.getCell(2).setCellStyle(percentageStyle);
					row.getCell(3).setCellStyle(dataStyle);
				}
				
				// Tổng cộng cho câu hỏi này
				org.apache.poi.ss.usermodel.Row totalRow = sheet.createRow(rowIdx++);
				totalRow.createCell(0).setCellValue("Tổng");
				totalRow.createCell(1).setCellValue(questionTotalResponses);
				totalRow.createCell(2).setCellValue(100.0);
				totalRow.createCell(3).setCellValue("");
				
				for (int i = 0; i < 4; i++) {
					totalRow.getCell(i).setCellStyle(headerStyle);
				}
				
			} else if (questionType == QuestionTypeEnum.open_ended) {
				// Câu hỏi mở - đếm số người trả lời
				List<Answer> allAnswers = answerRepository.findByQuestion(question);
				int answerCount = (int) allAnswers.stream()
						.filter(a -> a.getAnswerText() != null && !a.getAnswerText().trim().isEmpty())
						.map(a -> a.getResponse().getResponseId())
						.distinct()
						.count();
				
				org.apache.poi.ss.usermodel.Row row = sheet.createRow(rowIdx++);
				row.createCell(0).setCellValue("Câu hỏi mở");
				row.createCell(1).setCellValue(answerCount);
				double percentage = totalResponses > 0 ? (double) answerCount / totalResponses * 100 : 0.0;
				row.createCell(2).setCellValue(percentage);
				row.createCell(3).setCellValue(translateQuestionType(questionType));
				
				row.getCell(0).setCellStyle(dataStyle);
				row.getCell(1).setCellStyle(numberStyle);
				
				org.apache.poi.ss.usermodel.CellStyle percentageStyle = wb.createCellStyle();
				percentageStyle.cloneStyleFrom(numberStyle);
				org.apache.poi.ss.usermodel.CreationHelper createHelper = wb.getCreationHelper();
				percentageStyle.setDataFormat(createHelper.createDataFormat().getFormat("0.00"));
				row.getCell(2).setCellStyle(percentageStyle);
				row.getCell(3).setCellStyle(dataStyle);
				
			} else {
				// Các loại câu hỏi khác
				List<Answer> allAnswers = answerRepository.findByQuestion(question);
				int answerCount = (int) allAnswers.stream()
						.map(a -> a.getResponse().getResponseId())
						.distinct()
						.count();
				
				org.apache.poi.ss.usermodel.Row row = sheet.createRow(rowIdx++);
				row.createCell(0).setCellValue("Có trả lời");
				row.createCell(1).setCellValue(answerCount);
				double percentage = totalResponses > 0 ? (double) answerCount / totalResponses * 100 : 0.0;
				row.createCell(2).setCellValue(percentage);
				row.createCell(3).setCellValue(translateQuestionType(questionType));
				
				row.getCell(0).setCellStyle(dataStyle);
				row.getCell(1).setCellStyle(numberStyle);
				
				org.apache.poi.ss.usermodel.CellStyle percentageStyle = wb.createCellStyle();
				percentageStyle.cloneStyleFrom(numberStyle);
				org.apache.poi.ss.usermodel.CreationHelper createHelper = wb.getCreationHelper();
				percentageStyle.setDataFormat(createHelper.createDataFormat().getFormat("0.00"));
				row.getCell(2).setCellStyle(percentageStyle);
				row.getCell(3).setCellStyle(dataStyle);
			}
			
			rowIdx++; // Skip một dòng giữa các câu hỏi
		}
		
		// Auto-size columns
		for (int i = 0; i < 4; i++) {
			sheet.autoSizeColumn(i);
			int currentWidth = sheet.getColumnWidth(i);
			sheet.setColumnWidth(i, currentWidth + 1000);
			if (sheet.getColumnWidth(i) > 20000) {
				sheet.setColumnWidth(i, 20000);
			}
		}
	}
	
	/**
	 * Dịch loại câu hỏi sang tiếng Việt
	 */
	private String translateQuestionType(QuestionTypeEnum type) {
		if (type == null) return "N/A";
		switch (type) {
			case multiple_choice:
				return "Nhiều lựa chọn";
			case single_choice:
				return "Một lựa chọn";
			case boolean_:
				return "Có/Không";
			case rating:
				return "Đánh giá";
			case open_ended:
				return "Câu hỏi mở";
			case ranking:
				return "Xếp hạng";
			case date_time:
				return "Ngày/giờ";
			case file_upload:
				return "Tải file";
			default:
				return type.name();
		}
	}
	
	/**
	 * Tạo sheet Danh sách phản hồi
	 */
	private void createResponsesSheet(org.apache.poi.xssf.usermodel.XSSFWorkbook wb,
			Survey survey, List<Response> responses, boolean includeAnswers, List<Question> questions,
			org.apache.poi.ss.usermodel.CellStyle headerStyle,
			org.apache.poi.ss.usermodel.CellStyle dataStyle,
			org.apache.poi.ss.usermodel.CellStyle dateStyle,
			org.apache.poi.ss.usermodel.CellStyle numberStyle,
			org.apache.poi.ss.usermodel.CellStyle completedStyle,
			org.apache.poi.ss.usermodel.CellStyle partialStyle) {
		org.apache.poi.ss.usermodel.Sheet sheet = wb.createSheet("Danh sách phản hồi");
			int rowIdx = 0;
			
			// Header row
			org.apache.poi.ss.usermodel.Row header = sheet.createRow(rowIdx++);
			int col = 0;
		
		// Header tiếng Việt rõ ràng
		String[] headerNames = {"STT", "Mã phản hồi", "Ngày gửi", "Thời gian (giây)", "Trạng thái"};
			for (String headerName : headerNames) {
				org.apache.poi.ss.usermodel.Cell cell = header.createCell(col++);
				cell.setCellValue(headerName);
				cell.setCellStyle(headerStyle);
			}
		
			if (includeAnswers) {
				for (Question q : questions) {
					org.apache.poi.ss.usermodel.Cell cell = header.createCell(col++);
				String questionText = q.getQuestionText() != null ? q.getQuestionText() : ("Câu hỏi " + q.getQuestionId());
				// Giới hạn độ dài header
				if (questionText.length() > 50) {
					questionText = questionText.substring(0, 47) + "...";
				}
				cell.setCellValue(questionText);
					cell.setCellStyle(headerStyle);
				}
			}
			
			// Freeze panes để header luôn hiển thị
			sheet.createFreezePane(0, 1);
			
			List<Question> required = questions.stream().filter(q -> Boolean.TRUE.equals(q.getIsRequired())).toList();

			// Data rows
		int stt = 1;
			for (Response r : responses) {
				org.apache.poi.ss.usermodel.Row row = sheet.createRow(rowIdx++);
				int c = 0;
				String status = determineCompletionStatus(r, required);
			String statusVi = status.equals("completed") ? "Hoàn thành" : 
							  status.equals("partial") ? "Chưa hoàn thành" : "Bỏ dở";
				
			// STT
				org.apache.poi.ss.usermodel.Cell cell0 = row.createCell(c++);
			cell0.setCellValue(stt++);
				cell0.setCellStyle(numberStyle);
				
			// Response ID
				org.apache.poi.ss.usermodel.Cell cell1 = row.createCell(c++);
			cell1.setCellValue(r.getResponseId());
				cell1.setCellStyle(numberStyle);
				
			// Submitted At (Date format - dd/MM/yyyy HH:mm:ss)
				org.apache.poi.ss.usermodel.Cell cell2 = row.createCell(c++);
			if (r.getSubmittedAt() != null) {
				cell2.setCellValue(r.getSubmittedAt().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")));
				cell2.setCellStyle(dataStyle);
			} else {
				cell2.setCellValue("N/A");
				cell2.setCellStyle(dataStyle);
			}
			
			// Duration Seconds
				org.apache.poi.ss.usermodel.Cell cell3 = row.createCell(c++);
			cell3.setCellValue(r.getDurationSeconds() != null ? r.getDurationSeconds() : 0);
			cell3.setCellStyle(numberStyle);
				
			// Completion Status (có màu)
				org.apache.poi.ss.usermodel.Cell cell4 = row.createCell(c++);
			cell4.setCellValue(statusVi);
			if (status.equals("completed")) {
				cell4.setCellStyle(completedStyle);
				} else {
				cell4.setCellStyle(partialStyle);
			}
				
				if (includeAnswers) {
					List<Answer> answers = answerRepository.findByResponse(r);
					Map<Long, List<Answer>> byQ = answers.stream().collect(Collectors.groupingBy(a -> a.getQuestion().getQuestionId()));
					for (Question q : questions) {
						List<Answer> list = byQ.getOrDefault(q.getQuestionId(), List.of());
					String val = formatAnswerValue(list, q.getQuestionType());
						org.apache.poi.ss.usermodel.Cell cell = row.createCell(c++);
						cell.setCellValue(val);
						cell.setCellStyle(dataStyle);
					}
				}
			}
			
		// Auto-size columns với giới hạn
			for (int i = 0; i < col; i++) {
				sheet.autoSizeColumn(i);
				int currentWidth = sheet.getColumnWidth(i);
			// Thêm padding
				sheet.setColumnWidth(i, currentWidth + 1000);
			// Giới hạn độ rộng tối đa
			if (sheet.getColumnWidth(i) > 15000) {
				sheet.setColumnWidth(i, 15000);
			}
		}
	}
	
	/**
	 * Format giá trị câu trả lời
	 */
	private String formatAnswerValue(List<Answer> list, QuestionTypeEnum questionType) {
		if (list == null || list.isEmpty()) {
			return "";
		}
		
		if (questionType == QuestionTypeEnum.multiple_choice || questionType == QuestionTypeEnum.ranking) {
			// Nhiều lựa chọn - nối bằng dấu phẩy
			return list.stream()
					.filter(a -> a.getOption() != null)
					.map(a -> a.getOption().getOptionText())
					.filter(Objects::nonNull)
					.collect(Collectors.joining(", "));
		} else if (questionType == QuestionTypeEnum.single_choice || 
				   questionType == QuestionTypeEnum.boolean_ || 
				   questionType == QuestionTypeEnum.rating) {
			Answer a = list.get(0);
			if (a == null) return "";
			if (a.getOption() != null && a.getOption().getOptionText() != null) {
				return a.getOption().getOptionText();
			}
			return a.getAnswerText() != null ? a.getAnswerText() : "";
		} else {
			// Open-ended, date_time, file_upload, etc.
			Answer a = list.get(0);
			return a != null && a.getAnswerText() != null ? a.getAnswerText() : "";
		}
	}
	
	/**
	 * Helper methods để tạo styles
	 */
	private org.apache.poi.ss.usermodel.CellStyle createHeaderStyle(org.apache.poi.xssf.usermodel.XSSFWorkbook wb) {
		org.apache.poi.ss.usermodel.CellStyle style = wb.createCellStyle();
		org.apache.poi.ss.usermodel.Font font = wb.createFont();
		font.setBold(true);
		font.setFontHeightInPoints((short) 11);
		font.setColor(org.apache.poi.ss.usermodel.IndexedColors.WHITE.getIndex());
		style.setFont(font);
		style.setFillForegroundColor(org.apache.poi.ss.usermodel.IndexedColors.DARK_BLUE.getIndex());
		style.setFillPattern(org.apache.poi.ss.usermodel.FillPatternType.SOLID_FOREGROUND);
		style.setAlignment(org.apache.poi.ss.usermodel.HorizontalAlignment.CENTER);
		style.setVerticalAlignment(org.apache.poi.ss.usermodel.VerticalAlignment.CENTER);
		style.setBorderBottom(org.apache.poi.ss.usermodel.BorderStyle.THIN);
		style.setBorderTop(org.apache.poi.ss.usermodel.BorderStyle.THIN);
		style.setBorderLeft(org.apache.poi.ss.usermodel.BorderStyle.THIN);
		style.setBorderRight(org.apache.poi.ss.usermodel.BorderStyle.THIN);
		return style;
	}
	
	private org.apache.poi.ss.usermodel.CellStyle createDataStyle(org.apache.poi.xssf.usermodel.XSSFWorkbook wb) {
		org.apache.poi.ss.usermodel.CellStyle style = wb.createCellStyle();
		style.setBorderBottom(org.apache.poi.ss.usermodel.BorderStyle.THIN);
		style.setBorderTop(org.apache.poi.ss.usermodel.BorderStyle.THIN);
		style.setBorderLeft(org.apache.poi.ss.usermodel.BorderStyle.THIN);
		style.setBorderRight(org.apache.poi.ss.usermodel.BorderStyle.THIN);
		style.setWrapText(true);
		style.setVerticalAlignment(org.apache.poi.ss.usermodel.VerticalAlignment.TOP);
		return style;
	}
	
	private org.apache.poi.ss.usermodel.CellStyle createDateStyle(org.apache.poi.xssf.usermodel.XSSFWorkbook wb) {
		org.apache.poi.ss.usermodel.CellStyle style = createDataStyle(wb);
		org.apache.poi.ss.usermodel.CreationHelper createHelper = wb.getCreationHelper();
		style.setDataFormat(createHelper.createDataFormat().getFormat("dd/mm/yyyy hh:mm:ss"));
		return style;
	}
	
	private org.apache.poi.ss.usermodel.CellStyle createNumberStyle(org.apache.poi.xssf.usermodel.XSSFWorkbook wb) {
		org.apache.poi.ss.usermodel.CellStyle style = createDataStyle(wb);
		style.setAlignment(org.apache.poi.ss.usermodel.HorizontalAlignment.RIGHT);
		return style;
	}
	
	private org.apache.poi.ss.usermodel.CellStyle createTitleStyle(org.apache.poi.xssf.usermodel.XSSFWorkbook wb) {
		org.apache.poi.ss.usermodel.CellStyle style = wb.createCellStyle();
		org.apache.poi.ss.usermodel.Font font = wb.createFont();
		font.setBold(true);
		font.setFontHeightInPoints((short) 16);
		style.setFont(font);
		style.setAlignment(org.apache.poi.ss.usermodel.HorizontalAlignment.LEFT);
		style.setVerticalAlignment(org.apache.poi.ss.usermodel.VerticalAlignment.CENTER);
		return style;
	}
	
	private org.apache.poi.ss.usermodel.CellStyle createStatusStyle(org.apache.poi.xssf.usermodel.XSSFWorkbook wb, boolean isCompleted) {
		org.apache.poi.ss.usermodel.CellStyle style = createDataStyle(wb);
		org.apache.poi.ss.usermodel.Font font = wb.createFont();
		font.setBold(true);
		style.setFont(font);
		if (isCompleted) {
			style.setFillForegroundColor(org.apache.poi.ss.usermodel.IndexedColors.LIGHT_GREEN.getIndex());
		} else {
			style.setFillForegroundColor(org.apache.poi.ss.usermodel.IndexedColors.LIGHT_YELLOW.getIndex());
		}
		style.setFillPattern(org.apache.poi.ss.usermodel.FillPatternType.SOLID_FOREGROUND);
		style.setAlignment(org.apache.poi.ss.usermodel.HorizontalAlignment.CENTER);
		return style;
	}
	
	/**
	 * Helper method để thêm một dòng thông tin
	 */
	private void addInfoRow(org.apache.poi.ss.usermodel.Sheet sheet, int rowIdx, 
			String label, String value, org.apache.poi.ss.usermodel.CellStyle style) {
		org.apache.poi.ss.usermodel.Row row = sheet.createRow(rowIdx);
		row.createCell(0).setCellValue(label);
		row.createCell(1).setCellValue(value);
		row.getCell(0).setCellStyle(style);
		row.getCell(1).setCellStyle(style);
	}

	private org.springframework.http.ResponseEntity<byte[]> buildDownload(byte[] bytes, String contentType, String filename) {
		org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
		
		// Tạo filename với timestamp
		String timestamp = java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
		String baseName = filename.substring(0, filename.lastIndexOf('.'));
		String extension = filename.substring(filename.lastIndexOf('.'));
		String finalFilename = baseName + "_" + timestamp + extension;
		
		// Sử dụng cả filename và filename* để hỗ trợ UTF-8
		headers.add(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, 
			"attachment; filename=\"" + finalFilename + "\"; filename*=UTF-8''" + java.net.URLEncoder.encode(finalFilename, StandardCharsets.UTF_8));
		headers.add(org.springframework.http.HttpHeaders.CONTENT_TYPE, contentType);
		return org.springframework.http.ResponseEntity.ok().headers(headers).body(bytes);
	}

	private String escapeCsv(String v) {
		if (v == null) return "";
		boolean needQuotes = v.contains(",") || v.contains("\n") || v.contains("\r") || v.contains("\"");
		String s = v.replace("\"", "\"\"");
		return needQuotes ? ("\"" + s + "\"") : s;
	}



	private void validateSingleAnswer(Question question, AnswerSubmitDTO dto) throws IdInvalidException {
		QuestionTypeEnum type = question.getQuestionType();
		switch (type) {
			case single_choice:
				if (dto.getOptionId() == null && (dto.getAnswerText() == null || dto.getAnswerText().isBlank())) {
					throw new IdInvalidException("Câu hỏi trắc nghiệm một lựa chọn yêu cầu optionId hoặc answerText");
				}
				break;
			case multiple_choice:
				if ((dto.getSelectedOptionIds() == null || dto.getSelectedOptionIds().isEmpty())
						&& (dto.getSelectedOptions() == null || dto.getSelectedOptions().isEmpty())
						&& dto.getOptionId() == null) {
					throw new IdInvalidException(
							"Câu hỏi trắc nghiệm nhiều lựa chọn yêu cầu selectedOptionIds, selectedOptions hoặc optionId");
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
			case ranking:
				if (dto.getRankingOptionIds() != null && !dto.getRankingOptionIds().isEmpty()) {
					// Validate that all option IDs belong to the question
					List<Option> questionOptions = optionRepository.findByQuestionOrderByCreatedAt(question);
					List<Long> validOptionIds = questionOptions.stream()
							.map(Option::getOptionId)
							.collect(Collectors.toList());
					
					for (Long optionId : dto.getRankingOptionIds()) {
						if (!validOptionIds.contains(optionId)) {
							throw new IdInvalidException("Option ID " + optionId + " không thuộc câu hỏi ranking này");
						}
					}
					
					// Check if all options are ranked (optional - depends on business logic)
					if (dto.getRankingOptionIds().size() != validOptionIds.size()) {
						throw new IdInvalidException("Phải xếp hạng tất cả các options cho câu hỏi ranking");
					}
				} else if (dto.getRankingOrder() == null || dto.getRankingOrder().isEmpty()) {
					// Allow answerText for advanced ranking questions
					if (dto.getAnswerText() == null || dto.getAnswerText().isBlank()) {
						throw new IdInvalidException("Câu hỏi xếp hạng yêu cầu rankingOptionIds, rankingOrder hoặc answerText JSON");
					}
				}
				break;
			case date_time:
				if (dto.getDateValue() == null && dto.getTimeValue() == null) {
					// Allow answerText for advanced date/time questions
					if (dto.getAnswerText() == null || dto.getAnswerText().isBlank()) {
						throw new IdInvalidException("Câu hỏi ngày/giờ yêu cầu dateValue/timeValue hoặc answerText");
					}
				}
				break;
			case open_ended:
				if (dto.getAnswerText() == null || dto.getAnswerText().isBlank()) {
					throw new IdInvalidException("Câu hỏi mở yêu cầu answerText");
				}
				break;
			case file_upload:
				// File upload validation should be handled in file upload endpoint
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
				break;
		}
	}

    // Removed old counting helpers no longer exposed via API

	private User tryGetCurrentUserOrNull() {
		try {
			return authService.getCurrentUser();
		} catch (Exception e) {
			return null;
		}
	}

	private void parseDateTimeAnswer(String answerText, AnswerDTO ad) {
		if (answerText == null)
			return;

		String[] parts = answerText.split(";");
		for (String part : parts) {
			if (part.startsWith("date:")) {
				ad.setDateValue(part.substring(5));
			} else if (part.startsWith("time:")) {
				ad.setTimeValue(part.substring(5));
			}
		}
	}

	/**
	 * Submit response with files in single request
	 */
	@Transactional
	public ResponseWithAnswersDTO submitResponseWithFiles(Long surveyId, String answersJson,
			Map<String, MultipartFile> files) throws IdInvalidException {
		try {
			// Parse JSON answers
			ObjectMapper mapper = new ObjectMapper();
			List<AnswerSubmitDTO> answers = mapper.readValue(answersJson, new TypeReference<List<AnswerSubmitDTO>>() {
			});

			// Create request DTO
			ResponseSubmitRequestDTO request = new ResponseSubmitRequestDTO();
			request.setSurveyId(surveyId);
			request.setAnswers(answers);

			// Submit response first
			ResponseWithAnswersDTO response = submitResponse(request);

			// Handle file uploads for file_upload questions
			if (files != null && !files.isEmpty()) {
				for (Map.Entry<String, MultipartFile> entry : files.entrySet()) {
					String key = entry.getKey();
					MultipartFile file = entry.getValue();

					// Extract question ID from key (format: "file_questionId")
					if (key.startsWith("file_") && !file.isEmpty()) {
						try {
							Long questionId = Long.parseLong(key.substring(5));

							// Find corresponding answer by questionId
							Optional<AnswerDTO> answerDTO = response.getAnswers().stream()
									.filter(a -> a.getQuestionId().equals(questionId))
									.findFirst();

							if (answerDTO.isPresent()) {
								Answer answer = answerRepository.findById(answerDTO.get().getAnswerId())
										.orElse(null);

								if (answer != null) {
									// Inline file upload logic to avoid circular dependency
									try {
										// Generate unique filename
										String originalFilename = file.getOriginalFilename();
										if (originalFilename == null || originalFilename.trim().isEmpty()) {
											originalFilename = "unnamed_file";
										}

										String timestamp = LocalDateTime.now()
												.format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
										String uniqueFilename = UUID.randomUUID().toString() + "_" + timestamp + "_"
												+ originalFilename;

										// Create upload directory if not exists
										Path uploadPath = Paths.get(uploadDir);
										if (!Files.exists(uploadPath)) {
											Files.createDirectories(uploadPath);
										}

										// Save file to filesystem
										Path filePath = uploadPath.resolve(uniqueFilename);
										Files.copy(file.getInputStream(), filePath);

										// Save file record to database
										FileUpload fileUpload = new FileUpload();
										fileUpload.setAnswer(answer);
										fileUpload.setOriginalFileName(originalFilename);
										fileUpload.setFileName(uniqueFilename);
										fileUpload.setFileSize(file.getSize());
										fileUpload.setFileType(file.getContentType());
										fileUpload.setFilePath(filePath.toString());
										fileUploadRepository.save(fileUpload);

										// Update answer text with success message
										answer.setAnswerText("File uploaded successfully: " + originalFilename);
									} catch (Exception e) {
										// Handle upload error
										answer.setAnswerText("File upload failed: " + e.getMessage());
									}
									answerRepository.save(answer);
								}
							}
						} catch (NumberFormatException e) {
							// Skip invalid key format
						}
					}
				}
				
				// After all files are processed, regenerate the response DTO to include file info
				Response savedResponse = responseRepository.findById(response.getResponseId())
						.orElseThrow(() -> new IdInvalidException("Response not found"));
				return buildResponseWithAnswersDTO(savedResponse);
			}

			return response;

		} catch (Exception e) {
			throw new IdInvalidException("Lỗi khi xử lý request: " + e.getMessage());
		}
	}

	/**
	 * Map FileUpload entity to FileUploadInfo DTO
	 */
	private AnswerDTO.FileUploadInfo mapToFileUploadInfo(FileUpload fileUpload) {
		AnswerDTO.FileUploadInfo info = new AnswerDTO.FileUploadInfo();
		info.setFileId(fileUpload.getFileId());
		info.setOriginalFileName(fileUpload.getOriginalFileName());
		info.setFileName(fileUpload.getFileName());
		info.setFileType(fileUpload.getFileType());
		info.setFileSize(fileUpload.getFileSize());
		info.setUploadedAt(fileUpload.getCreatedAt());
		
		// Create download URL (assuming base URL from properties)
		info.setDownloadUrl("/api/files/download/" + fileUpload.getFileId());
		
		return info;
	}

	/**
	 * Build complete ResponseWithAnswersDTO from Response entity including file info
	 */
	private ResponseWithAnswersDTO buildResponseWithAnswersDTO(Response response) {
		ResponseWithAnswersDTO dto = new ResponseWithAnswersDTO();
		dto.setResponseId(response.getResponseId());
		dto.setSurveyId(response.getSurvey().getSurveyId());
		dto.setUserId(response.getUser() != null ? response.getUser().getUserId() : null);
		dto.setRequestToken(response.getRequestToken());
		dto.setSubmittedAt(response.getSubmittedAt());

		// Get all answers for this response
		List<Answer> allAnswers = answerRepository.findByResponse(response);
		
		// Group answers by question for multiple choice handling
		Map<Long, List<Answer>> answersByQuestion = allAnswers.stream()
				.collect(Collectors.groupingBy(a -> a.getQuestion().getQuestionId()));

		List<AnswerDTO> answerDTOs = new ArrayList<>();
		
		for (Map.Entry<Long, List<Answer>> entry : answersByQuestion.entrySet()) {
			Long questionId = entry.getKey();
			List<Answer> questionAnswers = entry.getValue();
			
			if (questionAnswers.isEmpty()) continue;
			
			Answer firstAnswer = questionAnswers.get(0);
			Question question = firstAnswer.getQuestion();
			
			AnswerDTO ad = new AnswerDTO();
			ad.setQuestionId(questionId);
			ad.setQuestionText(question.getQuestionText());
			ad.setCreatedAt(firstAnswer.getCreatedAt());
			
			// Handle different question types
			if (question.getQuestionType() == QuestionTypeEnum.multiple_choice) {
				// For multiple choice: collect all selected option IDs from multiple Answer records
				List<Long> selectedOptionIds = questionAnswers.stream()
						.filter(a -> a.getOption() != null)
						.map(a -> a.getOption().getOptionId())
						.distinct()
						.toList();
				
				ad.setSelectedOptionIds(selectedOptionIds);
				ad.setAnswerId(firstAnswer.getAnswerId()); // Use first answer's ID as representative
				// Don't set optionId or answerText for multiple choice
			} else if (question.getQuestionType() == QuestionTypeEnum.ranking) {
				// For ranking: handle both new and legacy formats
				processRankingAnswer(questionAnswers, ad);
			} else {
				// For single choice and other types: use the single Answer record
				ad.setAnswerId(firstAnswer.getAnswerId());
				ad.setOptionId(firstAnswer.getOption() != null ? firstAnswer.getOption().getOptionId() : null);
				ad.setAnswerText(firstAnswer.getAnswerText());
				
				// Parse special answer formats
				if (firstAnswer.getAnswerText() != null && question.getQuestionType() != null) {
					switch (question.getQuestionType()) {
						case date_time:
							parseDateTimeAnswer(firstAnswer.getAnswerText(), ad);
							break;
						case file_upload:
							// For file upload questions, get uploaded files info
							List<FileUpload> files = fileUploadRepository.findByAnswer(firstAnswer);
							if (!files.isEmpty()) {
								List<AnswerDTO.FileUploadInfo> fileInfos = files.stream()
										.map(this::mapToFileUploadInfo)
										.toList();
								ad.setUploadedFiles(fileInfos);
							}
							break;
						default:
							break;
					}
				}
			}
			
			answerDTOs.add(ad);
		}

		dto.setAnswers(answerDTOs);
		return dto;
	}

	/**
	 * Helper method to process ranking answers for both new and legacy formats
	 */
	private void processRankingAnswer(List<Answer> questionAnswers, AnswerDTO ad) {
		Answer firstAnswer = questionAnswers.get(0);
		
		// Check if we have multiple Answer records with option_id and ranks (new format)
		boolean hasRankingRecords = questionAnswers.stream()
				.allMatch(a -> a.getOption() != null && a.getAnswerText() != null);
		
		if (hasRankingRecords && questionAnswers.size() > 1) {
			// New ranking format: multiple records with option_id and rank
			List<Long> rankingOptionIds = questionAnswers.stream()
					.sorted((a1, a2) -> {
						// Sort by rank (stored in answerText)
						try {
							int rank1 = Integer.parseInt(a1.getAnswerText());
							int rank2 = Integer.parseInt(a2.getAnswerText());
							return Integer.compare(rank1, rank2);
						} catch (NumberFormatException e) {
							return 0;
						}
					})
					.map(a -> a.getOption().getOptionId())
					.toList();
			
			ad.setRankingOptionIds(rankingOptionIds);
			ad.setAnswerId(firstAnswer.getAnswerId()); // Use first answer's ID as representative
		} else {
			// Legacy ranking format: JSON string in answerText
			ad.setAnswerId(firstAnswer.getAnswerId());
			ad.setAnswerText(firstAnswer.getAnswerText());
			if (firstAnswer.getAnswerText() != null) {
				ad.setRankingOrder(answerDataHelper.deserializeRankingOrder(firstAnswer.getAnswerText()));
			}
		}
	}
/**
     * Convert Answer entity to AnswerDTO
     */
    private AnswerDTO convertToAnswerDTO(Answer answer) {
        AnswerDTO dto = new AnswerDTO();
        dto.setAnswerId(answer.getAnswerId());
        dto.setQuestionId(answer.getQuestion().getQuestionId());
        dto.setQuestionText(answer.getQuestion().getQuestionText());
        dto.setAnswerText(answer.getAnswerText());
        dto.setCreatedAt(answer.getCreatedAt());
        
        if (answer.getOption() != null) {
            dto.setOptionId(answer.getOption().getOptionId());
        }
        
        // Handle file uploads
        if (answer.getQuestion().getQuestionType() == QuestionTypeEnum.file_upload) {
            List<FileUpload> files = fileUploadRepository.findByAnswer(answer);
            if (!files.isEmpty()) {
                List<AnswerDTO.FileUploadInfo> fileInfos = files.stream()
                        .map(this::mapToFileUploadInfo)
                        .toList();
                dto.setUploadedFiles(fileInfos);
            }
        }
        
        return dto;
    }
	/**
	 * Lấy chi tiết response với tất cả answers
	 */
    // Removed response detail per request

    // Removed export per request

    // Removed old paginated method; FE will handle pagination if needed

    // Removed bulk delete per request


}