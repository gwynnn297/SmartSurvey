package vn.duytan.c1se09.smartsurvey.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.duytan.c1se09.smartsurvey.domain.*;
import vn.duytan.c1se09.smartsurvey.domain.request.question.QuestionCreateRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.question.QuestionUpdateRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.question.QuestionResponseDTO;
import vn.duytan.c1se09.smartsurvey.repository.*;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;

import java.util.List;

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
        dto.setCreatedAt(question.getCreatedAt());
        dto.setUpdatedAt(question.getUpdatedAt());
        return dto;
    }

    @Transactional
    public QuestionResponseDTO createQuestion(QuestionCreateRequestDTO request) throws IdInvalidException {
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new IdInvalidException("Người dùng chưa xác thực");
        }

        // Kiểm tra survey tồn tại và thuộc về user hiện tại
        Survey survey = surveyRepository.findById(request.getSurveyId())
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));
        
        if (!survey.getUser().getUserId().equals(currentUser.getUserId())) {
            throw new IdInvalidException("Bạn không có quyền thêm câu hỏi vào khảo sát này");
        }

        Question question = new Question();
        question.setSurvey(survey);
        question.setQuestionText(request.getQuestionText());
        question.setQuestionType(request.getQuestionType());
        question.setIsRequired(request.getIsRequired() != null ? request.getIsRequired() : true);

        Question saved = questionRepository.save(question);
        
        // Log activity
        activityLogService.log(
                ActivityLog.ActionType.add_question,
                saved.getQuestionId(),
                "questions",
                "Tạo câu hỏi mới: " + saved.getQuestionText());

        return toQuestionResponseDTO(saved);
    }

    public List<QuestionResponseDTO> getQuestionsBySurvey(Long surveyId) throws IdInvalidException {
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new IdInvalidException("Người dùng chưa xác thực");
        }

        Survey survey = surveyRepository.findById(surveyId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));
        
        if (!survey.getUser().getUserId().equals(currentUser.getUserId())) {
            throw new IdInvalidException("Bạn không có quyền xem câu hỏi của khảo sát này");
        }

        List<Question> questions = questionRepository.findBySurveyOrderByCreatedAt(survey);
        return questions.stream().map(this::toQuestionResponseDTO).toList();
    }

    public QuestionResponseDTO getQuestionById(Long questionId) throws IdInvalidException {
        Question question = getQuestionEntityById(questionId);
        
        // Kiểm tra quyền
        User currentUser = authService.getCurrentUser();
        if (!question.getSurvey().getUser().getUserId().equals(currentUser.getUserId())) {
            throw new IdInvalidException("Bạn không có quyền xem câu hỏi này");
        }
        
        return toQuestionResponseDTO(question);
    }

    @Transactional
    public QuestionResponseDTO updateQuestion(Long questionId, QuestionUpdateRequestDTO request) throws IdInvalidException {
        Question question = getQuestionEntityById(questionId);
        
        // Kiểm tra quyền
        User currentUser = authService.getCurrentUser();
        if (!question.getSurvey().getUser().getUserId().equals(currentUser.getUserId())) {
            throw new IdInvalidException("Bạn không có quyền cập nhật câu hỏi này");
        }

        if (request.getQuestionText() != null && !request.getQuestionText().isEmpty()) {
            question.setQuestionText(request.getQuestionText());
        }
        if (request.getQuestionType() != null) {
            question.setQuestionType(request.getQuestionType());
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

    @Transactional
    public void deleteQuestion(Long questionId) throws IdInvalidException {
        Question question = getQuestionEntityById(questionId);
        
        // Kiểm tra quyền
        User currentUser = authService.getCurrentUser();
        if (!question.getSurvey().getUser().getUserId().equals(currentUser.getUserId())) {
            throw new IdInvalidException("Bạn không có quyền xóa câu hỏi này");
        }

        questionRepository.delete(question);
        
        activityLogService.log(
                ActivityLog.ActionType.delete_question,
                questionId,
                "questions",
                "Xóa câu hỏi: " + question.getQuestionText());
    }

    public long getTotalQuestions() {
        return questionRepository.count();
    }

    public long getQuestionsCountBySurvey(Long surveyId) throws IdInvalidException {
        Survey survey = surveyRepository.findById(surveyId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));
        return questionRepository.countBySurvey(survey);
    }
} 