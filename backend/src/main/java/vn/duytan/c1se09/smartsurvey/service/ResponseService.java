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
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
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

	@Value("${app.upload.dir:uploads}")
	private String uploadDir;

	@Transactional
	public ResponseWithAnswersDTO submitResponse(ResponseSubmitRequestDTO request) throws IdInvalidException {
		Survey survey = surveyRepository.findById(request.getSurveyId())
				.orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));

		// Kiểm tra survey có published không
		if (survey.getStatus() != SurveyStatusEnum.published) {
			throw new IdInvalidException("Khảo sát không khả dụng để trả lời. Trạng thái hiện tại: " +
					(survey.getStatus() != null ? survey.getStatus().name() : "null"));
		}

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
				List<AnswerSubmitDTO> provided = answersByQuestion.getOrDefault(q.getQuestionId(),
						Collections.emptyList());
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
			
			// For all question types: check if there are uploaded files
			if (question.getQuestionType() == QuestionTypeEnum.file_upload) {
				List<FileUpload> files = fileUploadRepository.findByAnswer(firstAnswer);
				if (!files.isEmpty()) {
					List<AnswerDTO.FileUploadInfo> fileInfos = files.stream()
							.map(this::mapToFileUploadInfo)
							.toList();
					ad.setUploadedFiles(fileInfos);
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

	private boolean isValidProvidedForType(Question q, List<AnswerSubmitDTO> provided) {
		QuestionTypeEnum type = q.getQuestionType();
		switch (type) {
			case single_choice:
			case boolean_:
			case rating:
				return provided.stream().anyMatch(a -> (a.getAnswerText() != null && !a.getAnswerText().isBlank())
						|| a.getOptionId() != null);
			case multiple_choice:
				return provided.stream()
						.anyMatch(a -> (a.getSelectedOptions() != null && !a.getSelectedOptions().isEmpty())
								|| (a.getSelectedOptionIds() != null && !a.getSelectedOptionIds().isEmpty())
								|| a.getOptionId() != null);
			case open_ended:
				return provided.stream().anyMatch(a -> a.getAnswerText() != null && !a.getAnswerText().isBlank());
			case ranking:
				return provided.stream().anyMatch(a -> (a.getAnswerText() != null && !a.getAnswerText().isBlank())
						|| (a.getRankingOrder() != null && !a.getRankingOrder().isEmpty())
						|| (a.getRankingOptionIds() != null && !a.getRankingOptionIds().isEmpty()));
			case date_time:
				return provided.stream().anyMatch(a -> (a.getAnswerText() != null && !a.getAnswerText().isBlank())
						|| a.getDateValue() != null || a.getTimeValue() != null);
			case file_upload:
				return provided.stream().anyMatch(a -> a.getAnswerText() != null && !a.getAnswerText().isBlank());
			default:
				return false;
		}
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

	/**
	 * Đếm số lượng responses của một survey
	 */
	@Transactional(readOnly = true)
	public long getResponseCountBySurvey(Long surveyId) throws IdInvalidException {
		Survey survey = surveyRepository.findById(surveyId)
				.orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));
		return responseRepository.countBySurvey(survey);
	}

	/**
	 * Đếm tổng số lượng responses của tất cả survey
	 */
	@Transactional(readOnly = true)
	public long getTotalResponseCount() {
		return responseRepository.count();
	}

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
			
			// For all question types: check if there are uploaded files
			if (question.getQuestionType() == QuestionTypeEnum.file_upload) {
				List<FileUpload> files = fileUploadRepository.findByAnswer(firstAnswer);
				if (!files.isEmpty()) {
					List<AnswerDTO.FileUploadInfo> fileInfos = files.stream()
							.map(this::mapToFileUploadInfo)
							.toList();
					ad.setUploadedFiles(fileInfos);
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

}