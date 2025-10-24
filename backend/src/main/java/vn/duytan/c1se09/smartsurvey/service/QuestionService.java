package vn.duytan.c1se09.smartsurvey.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.duytan.c1se09.smartsurvey.domain.*;
import vn.duytan.c1se09.smartsurvey.domain.request.question.QuestionCreateRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.question.QuestionUpdateRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.question.QuestionResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.question.QuestionCreateResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.question.QuestionUpdateResponseDTO;
import vn.duytan.c1se09.smartsurvey.repository.*;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;
import vn.duytan.c1se09.smartsurvey.util.helper.QuestionConfigHelper;
import vn.duytan.c1se09.smartsurvey.util.constant.QuestionTypeEnum;
import vn.duytan.c1se09.smartsurvey.util.validator.QuestionValidator;


import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Service xử lý logic business cho Question
 */
@Service
@RequiredArgsConstructor
public class QuestionService {
    private final QuestionRepository questionRepository;
    private final SurveyRepository surveyRepository;
    private final AuthService authService;
    private final ActivityLogService activityLogService;
    private final QuestionConfigHelper questionConfigHelper;
    private final QuestionValidator questionValidator;


    // lấy thông tin câu hỏi
    public Question getQuestionEntityById(Long questionId) throws IdInvalidException {
        return questionRepository.findById(questionId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy câu hỏi"));
    }

    private QuestionResponseDTO toQuestionResponseDTO(Question question) {
        QuestionResponseDTO dto = new QuestionResponseDTO();
        dto.setId(question.getQuestionId());
        dto.setSurveyId(question.getSurvey().getSurveyId());
        dto.setSurveyTitle(question.getSurvey().getTitle());
        dto.setQuestionText(question.getQuestionText());
        dto.setQuestionType(question.getQuestionType().name());
        dto.setQuestionTypeDescription(question.getQuestionType().getDescription());
        dto.setIsRequired(question.getIsRequired());
        dto.setDisplayOrder(question.getDisplayOrder());
        dto.setCreatedAt(question.getCreatedAt());
        dto.setUpdatedAt(question.getUpdatedAt());
        
        // Deserialize question config based on type
        if (question.getQuestionConfig() != null) {
            switch (question.getQuestionType()) {
                case ranking:
                    dto.setRankingConfig(questionConfigHelper.deserializeRankingConfig(question.getQuestionConfig()));
                    break;
                case file_upload:
                    dto.setFileUploadConfig(questionConfigHelper.deserializeFileUploadConfig(question.getQuestionConfig()));
                    break;
                case date_time:
                    dto.setDateTimeConfig(questionConfigHelper.deserializeDateTimeConfig(question.getQuestionConfig()));
                    break;
                default:
                    // No additional config needed for other types
                    break;
            }
        }
        
        return dto;
    }


    private void validateUserPermission(Survey survey) throws IdInvalidException {
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new IdInvalidException("Người dùng chưa xác thực");
        }
        
        if (!survey.getUser().getUserId().equals(currentUser.getUserId())) {
            throw new IdInvalidException("Bạn không có quyền thực hiện thao tác này");
        }
    }

    private void validateUserPermission(Question question) throws IdInvalidException {
        validateUserPermission(question.getSurvey());
    }

    // tạo câu hỏi 

    /**
     * Tạo câu hỏi mới (phương thức chính)
     * @param surveyId 
     * @param request 
     * @return 
     */
    @Transactional
    public QuestionResponseDTO createQuestion(Long surveyId, QuestionCreateRequestDTO request) throws IdInvalidException {
        
        // Validate question configuration
        questionValidator.validateQuestionRequest(request);
        
        Survey survey = surveyRepository.findById(surveyId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));
        
       
        validateUserPermission(survey);

        
        Question question = new Question();
        question.setSurvey(survey);
        question.setQuestionText(request.getQuestionText());
        question.setQuestionType(request.getQuestionType());
        question.setIsRequired(request.getIsRequired() != null ? request.getIsRequired() : true);

        // Handle question config based on type
        String configJson = null;
        switch (request.getQuestionType()) {
            case ranking:
                if (request.getRankingConfig() != null) {
                    configJson = questionConfigHelper.serializeQuestionConfig(request.getQuestionType(), request.getRankingConfig());
                }
                break;
            case file_upload:
                if (request.getFileUploadConfig() != null) {
                    configJson = questionConfigHelper.serializeQuestionConfig(request.getQuestionType(), request.getFileUploadConfig());
                }
                break;
            case date_time:
                if (request.getDateTimeConfig() != null) {
                    configJson = questionConfigHelper.serializeQuestionConfig(request.getQuestionType(), request.getDateTimeConfig());
                }
                break;
            default:
                // No additional config needed for other types
                break;
        }
        question.setQuestionConfig(configJson);

        // set display order to max + 1 within survey
        int maxOrder = questionRepository.findMaxDisplayOrderBySurvey(survey);
        question.setDisplayOrder(maxOrder + 1);

        Question saved = questionRepository.save(question);
        
        // Log activity
        activityLogService.log(
                ActivityLog.ActionType.add_question,
                saved.getQuestionId(),
                "questions",
                "Tạo câu hỏi: " + saved.getQuestionText());

        return toQuestionResponseDTO(saved);
    }

    /**
     * Tạo câu hỏi mới với response message
     * @param surveyId 
     * @param request 
     * @return 
     */
    @Transactional
    public QuestionCreateResponseDTO createQuestionWithResponse(Long surveyId, QuestionCreateRequestDTO request) throws IdInvalidException {
        QuestionResponseDTO questionDTO = createQuestion(surveyId, request);
       
        QuestionCreateResponseDTO response = new QuestionCreateResponseDTO();
        response.setId(questionDTO.getId());
        response.setSurveyId(questionDTO.getSurveyId());
        response.setSurveyTitle(questionDTO.getSurveyTitle());
        response.setQuestionText(questionDTO.getQuestionText());
        response.setQuestionType(questionDTO.getQuestionType());
        response.setQuestionTypeDescription(questionDTO.getQuestionTypeDescription());
        response.setIsRequired(questionDTO.getIsRequired());
        response.setMessage("Tạo câu hỏi thành công!");
        response.setCreatedAt(questionDTO.getCreatedAt());
        response.setUpdatedAt(questionDTO.getUpdatedAt());
        
        return response;
    }

    // đọc danh sách câu hỏi trong survey
    
    public List<QuestionResponseDTO> getQuestionsBySurvey(Long surveyId) throws IdInvalidException {
        Survey survey = surveyRepository.findById(surveyId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));
        
        validateUserPermission(survey);

        List<Question> questions = questionRepository.findBySurveyOrderByDisplayOrderAsc(survey);
        return questions.stream().map(this::toQuestionResponseDTO).toList();
    }

    public QuestionResponseDTO getQuestionById(Long questionId) throws IdInvalidException {
        Question question = getQuestionEntityById(questionId);
        validateUserPermission(question);
        return toQuestionResponseDTO(question);
    }

    /**
     * Reorder theo danh sách id (1..N) cho một survey
     */
    @Transactional
    public void reorderQuestions(Long surveyId, List<Long> orderedQuestionIds) throws IdInvalidException {
        Survey survey = surveyRepository.findById(surveyId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));
        validateUserPermission(survey);

        List<Question> questions = questionRepository.findBySurvey(survey);
        if (orderedQuestionIds.size() != questions.size()) {
            throw new IdInvalidException("Danh sách id không khớp số lượng câu hỏi trong khảo sát");
        }
        Set<Long> validIds = questions.stream().map(Question::getQuestionId).collect(Collectors.toSet());
        for (Long id : orderedQuestionIds) {
            if (!validIds.contains(id)) {
                throw new IdInvalidException("Câu hỏi không thuộc khảo sát");
            }
        }
        for (int i = 0; i < orderedQuestionIds.size(); i++) {
            Long qid = orderedQuestionIds.get(i);
            for (Question q : questions) {
                if (q.getQuestionId().equals(qid)) {
                    q.setDisplayOrder(i + 1);
                    questionRepository.save(q);
                    break;
                }
            }
        }

        activityLogService.log(
                ActivityLog.ActionType.edit_question,
                surveyId,
                "questions",
                "Sắp xếp lại thứ tự câu hỏi cho khảo sát: " + survey.getTitle());
    }

    // cập nhập câu hỏi
    
    /**
     * Cập nhật câu hỏi
     * @param questionId 
     * @param request 
     * @return
     */
    @Transactional
    public QuestionResponseDTO updateQuestion(Long questionId, QuestionUpdateRequestDTO request) throws IdInvalidException {
        Question question = getQuestionEntityById(questionId);
        validateUserPermission(question);

        if (request.getQuestionText() != null && !request.getQuestionText().isEmpty()) {
            question.setQuestionText(request.getQuestionText());
        }
        
        if (request.getQuestionType() != null) {
            question.setQuestionType(request.getQuestionType());
            
            // Update question config when type changes
            String configJson = null;
            switch (request.getQuestionType()) {
                case ranking:
                    if (request.getRankingConfig() != null) {
                        configJson = questionConfigHelper.serializeQuestionConfig(request.getQuestionType(), request.getRankingConfig());
                    }
                    break;
                case file_upload:
                    if (request.getFileUploadConfig() != null) {
                        configJson = questionConfigHelper.serializeQuestionConfig(request.getQuestionType(), request.getFileUploadConfig());
                    }
                    break;
                case date_time:
                    if (request.getDateTimeConfig() != null) {
                        configJson = questionConfigHelper.serializeQuestionConfig(request.getQuestionType(), request.getDateTimeConfig());
                    }
                    break;
                default:
                    // Clear config for simple types
                    configJson = null;
                    break;
            }
            question.setQuestionConfig(configJson);
        } else {
            // Update config for existing type
            if (question.getQuestionType() != null) {
                String configJson = null;
                switch (question.getQuestionType()) {
                    case ranking:
                        if (request.getRankingConfig() != null) {
                            configJson = questionConfigHelper.serializeQuestionConfig(question.getQuestionType(), request.getRankingConfig());
                        }
                        break;
                    case file_upload:
                        if (request.getFileUploadConfig() != null) {
                            configJson = questionConfigHelper.serializeQuestionConfig(question.getQuestionType(), request.getFileUploadConfig());
                        }
                        break;
                    case date_time:
                        if (request.getDateTimeConfig() != null) {
                            configJson = questionConfigHelper.serializeQuestionConfig(question.getQuestionType(), request.getDateTimeConfig());
                        }
                        break;
                    default:
                        break;
                }
                if (configJson != null) {
                    question.setQuestionConfig(configJson);
                }
            }
        }
        
        if (request.getIsRequired() != null) {
            question.setIsRequired(request.getIsRequired());
        }

        Question saved = questionRepository.save(question);
        
        activityLogService.log(
                ActivityLog.ActionType.edit_question,
                saved.getQuestionId(),
                "questions",
                "Cập nhật câu hỏi: " + saved.getQuestionText());

        return toQuestionResponseDTO(saved);
    }

    /**
     * Cập nhật câu hỏi với response message
     * @param questionId 
     * @param request 
     * @return 
     */
    @Transactional
    public QuestionUpdateResponseDTO updateQuestionWithResponse(Long questionId, QuestionUpdateRequestDTO request) throws IdInvalidException {
        QuestionResponseDTO updatedDTO = updateQuestion(questionId, request);
        
        QuestionUpdateResponseDTO response = new QuestionUpdateResponseDTO();
        response.setId(updatedDTO.getId());
        response.setSurveyId(updatedDTO.getSurveyId());
        response.setSurveyTitle(updatedDTO.getSurveyTitle());
        response.setQuestionText(updatedDTO.getQuestionText());
        response.setQuestionType(updatedDTO.getQuestionType());
        response.setQuestionTypeDescription(updatedDTO.getQuestionTypeDescription());
        response.setIsRequired(updatedDTO.getIsRequired());
        response.setMessage("Cập nhật câu hỏi thành công!");
        response.setCreatedAt(updatedDTO.getCreatedAt());
        response.setUpdatedAt(updatedDTO.getUpdatedAt());
        
        return response;
    }

    // xóa câu hỏi
    
    @Transactional
    public void deleteQuestion(Long questionId) throws IdInvalidException {
        Question question = getQuestionEntityById(questionId);
        validateUserPermission(question);

        questionRepository.delete(question);
        
        activityLogService.log(
                ActivityLog.ActionType.delete_question,
                questionId,
                "questions",
                "Xóa câu hỏi: " + question.getQuestionText());
    }

  // Tổng số câu hỏi trong hệ thống
    public long getTotalQuestions() {
        return questionRepository.count();
    }
 // Số câu hỏi của một khảo sát cụ thể
    public long getQuestionsCountBySurvey(Long surveyId) throws IdInvalidException {
        Survey survey = surveyRepository.findById(surveyId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));
        return questionRepository.countBySurvey(survey);
    }
} 