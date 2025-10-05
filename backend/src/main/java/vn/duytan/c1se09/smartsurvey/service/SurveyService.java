package vn.duytan.c1se09.smartsurvey.service;

import vn.duytan.c1se09.smartsurvey.domain.response.survey.SurveyResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.survey.SurveyDetailResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.survey.SurveyCreateRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.survey.SurveyUpdateRequestDTO;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.duytan.c1se09.smartsurvey.domain.*;
import vn.duytan.c1se09.smartsurvey.domain.ActivityLog;
import vn.duytan.c1se09.smartsurvey.repository.*;
import vn.duytan.c1se09.smartsurvey.util.constant.SurveyStatusEnum;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import vn.duytan.c1se09.smartsurvey.domain.response.survey.SurveyFetchResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.survey.SurveyPaginationDTO;

/**
 * Service xử lý logic business cho Survey
 */
@Service
@RequiredArgsConstructor
public class SurveyService {
    private final SurveyRepository surveyRepository;
    private final CategoryRepository categoryRepository;
    private final QuestionRepository questionRepository;
    private final OptionRepository optionRepository;
    private final AuthService authService;
    private final ActivityLogService activityLogService;

    public Survey getSurveyEntityById(Long surveyId) throws IdInvalidException {
        return surveyRepository.findById(surveyId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));
    }

    private SurveyResponseDTO toSurveyResponseDTO(Survey survey) {
        SurveyResponseDTO dto = new SurveyResponseDTO();
        dto.setId(survey.getSurveyId());
        dto.setTitle(survey.getTitle());
        dto.setDescription(survey.getDescription());
        dto.setStatus(survey.getStatus() != null ? survey.getStatus().name() : null);
        dto.setAiPrompt(survey.getAiPrompt());
        dto.setTargetAudience(survey.getTargetAudience());
        dto.setNumberOfQuestions(survey.getNumberOfQuestions());
        if (survey.getCategory() != null) {
            dto.setCategoryId(survey.getCategory().getCategoryId());
            dto.setCategoryName(survey.getCategory().getCategoryName());
        }
        if (survey.getUser() != null) {
            dto.setUserId(survey.getUser().getUserId());
            dto.setUserName(survey.getUser().getFullName());
        }
        dto.setCreatedAt(survey.getCreatedAt());
        dto.setUpdatedAt(survey.getUpdatedAt());
        return dto;
    }

    public Category getCategoryById(Long categoryId) throws IdInvalidException {
        return categoryRepository.findById(categoryId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy danh mục"));
    }

    @Transactional
    public Survey updateSurvey(Survey survey) {
        // Có thể bổ sung kiểm tra quyền, validation tại đây
        return surveyRepository.save(survey);
    }

    @Transactional
    public SurveyResponseDTO createSurvey(SurveyCreateRequestDTO request) throws IdInvalidException {
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new IdInvalidException("Người dùng chưa xác thực");
        }

        Survey survey = new Survey();
        survey.setTitle(request.getTitle());
        survey.setDescription(request.getDescription());
        survey.setUser(currentUser);
        survey.setStatus(SurveyStatusEnum.draft);
        survey.setAiPrompt(request.getAiPrompt());

        if (request.getCategoryId() != null) {
            Category category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new IdInvalidException("Không tìm thấy danh mục"));
            survey.setCategory(category);
        }

        Survey saved = surveyRepository.save(survey);
        // log activity
        activityLogService.log(
                ActivityLog.ActionType.create_survey,
                saved.getSurveyId(),
                "surveys",
                "Tạo khảo sát mới: " + saved.getTitle());
        return toSurveyResponseDTO(saved);
    }

    public List<SurveyResponseDTO> getMySurveys() throws IdInvalidException {
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new IdInvalidException("Người dùng chưa xác thực");
        }
        List<Survey> surveys = surveyRepository.findByUser(currentUser);
        return surveys.stream().map(this::toSurveyResponseDTO).toList();
    }

    public SurveyPaginationDTO getMySurveysPaginated(int page, int size) throws IdInvalidException {
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new IdInvalidException("Người dùng chưa xác thực");
        }
        if (page < 0)
            page = 0;
        if (size <= 0 || size > 100)
            size = 10;
        Pageable pageable = PageRequest.of(page, size);
        Page<Survey> surveyPage = surveyRepository.findByUser(currentUser, pageable);
        SurveyPaginationDTO dto = new SurveyPaginationDTO();
        SurveyPaginationDTO.Meta meta = new SurveyPaginationDTO.Meta();
        meta.setPage(page);
        meta.setPageSize(size);
        meta.setPages(surveyPage.getTotalPages());
        meta.setTotal(surveyPage.getTotalElements());
        dto.setMeta(meta);
        dto.setResult(surveyPage.getContent().stream().map(s -> {
            SurveyFetchResponseDTO f = new SurveyFetchResponseDTO();
            f.setId(s.getSurveyId());
            f.setTitle(s.getTitle());
            f.setDescription(s.getDescription());
            f.setStatus(s.getStatus() != null ? s.getStatus().name() : null);
            f.setAiPrompt(s.getAiPrompt());
            if (s.getCategory() != null) {
                f.setCategoryId(s.getCategory().getCategoryId());
                f.setCategoryName(s.getCategory().getCategoryName());
            }
            if (s.getUser() != null) {
                f.setUserId(s.getUser().getUserId());
                f.setUserName(s.getUser().getFullName());
            }
            f.setCreatedAt(s.getCreatedAt());
            f.setUpdatedAt(s.getUpdatedAt());
            return f;
        }).toList());
        return dto;
    }

    public SurveyResponseDTO getSurveyById(Long surveyId) throws IdInvalidException {
        Survey survey = getSurveyEntityById(surveyId);
        return toSurveyResponseDTO(survey);
    }

    /**
     * Lấy chi tiết survey với questions và options đầy đủ
     */
    public SurveyDetailResponseDTO getSurveyByIdWithDetails(Long surveyId) throws IdInvalidException {
        Survey survey = getSurveyEntityById(surveyId);

        // Kiểm tra quyền truy cập
        User currentUser = authService.getCurrentUser();
        if (!survey.getUser().getUserId().equals(currentUser.getUserId())) {
            throw new IdInvalidException("Bạn không có quyền xem chi tiết khảo sát này");
        }

        SurveyDetailResponseDTO dto = new SurveyDetailResponseDTO();
        dto.setId(survey.getSurveyId());
        dto.setTitle(survey.getTitle());
        dto.setDescription(survey.getDescription());
        dto.setStatus(survey.getStatus() != null ? survey.getStatus().name() : null);
        dto.setAiPrompt(survey.getAiPrompt());

        if (survey.getCategory() != null) {
            dto.setCategoryId(survey.getCategory().getCategoryId());
            dto.setCategoryName(survey.getCategory().getCategoryName());
        }

        if (survey.getUser() != null) {
            dto.setUserId(survey.getUser().getUserId());
            dto.setUserName(survey.getUser().getFullName());
        }

        dto.setCreatedAt(survey.getCreatedAt());
        dto.setUpdatedAt(survey.getUpdatedAt());

        // Lấy danh sách questions với options
        List<Question> questions = questionRepository.findBySurveyOrderByDisplayOrderAsc(survey);
        List<SurveyDetailResponseDTO.QuestionCompactDTO> questionDTOs = questions.stream().map(question -> {
            SurveyDetailResponseDTO.QuestionCompactDTO qDto = new SurveyDetailResponseDTO.QuestionCompactDTO();
            qDto.setId(question.getQuestionId());
            qDto.setText(question.getQuestionText());
            qDto.setType(question.getQuestionType().name().toLowerCase());
            qDto.setRequired(question.getIsRequired());
            qDto.setOrder(question.getDisplayOrder());

            // Lấy options cho question này (compact)
            List<Option> options = optionRepository.findByQuestion(question);
            List<SurveyDetailResponseDTO.OptionCompactDTO> optionDTOs = options.stream().map(option -> {
                SurveyDetailResponseDTO.OptionCompactDTO oDto = new SurveyDetailResponseDTO.OptionCompactDTO();
                oDto.setId(option.getOptionId());
                oDto.setText(option.getOptionText());
                return oDto;
            }).toList();

            qDto.setOptions(optionDTOs);
            return qDto;
        }).toList();

        dto.setQuestions(questionDTOs);
        return dto;
    }

    @Transactional
    public Survey updateSurveyStatus(Long surveyId, SurveyStatusEnum status) throws IdInvalidException {
        Survey survey = getSurveyEntityById(surveyId);
        User currentUser = authService.getCurrentUser();
        if (!survey.getUser().getUserId().equals(currentUser.getUserId())) {
            throw new IdInvalidException("Bạn không có quyền cập nhật khảo sát này");
        }
        survey.setStatus(status);
        return surveyRepository.save(survey);
    }

    @Transactional
    public SurveyResponseDTO updateSurvey(Long surveyId, SurveyUpdateRequestDTO request) throws IdInvalidException {
        Survey survey = getSurveyEntityById(surveyId);
        User currentUser = authService.getCurrentUser();
        if (!survey.getUser().getUserId().equals(currentUser.getUserId())) {
            throw new IdInvalidException("Bạn không có quyền cập nhật khảo sát này");
        }

        if (request.getTitle() != null && !request.getTitle().isEmpty()) {
            survey.setTitle(request.getTitle());
        }
        if (request.getDescription() != null) {
            survey.setDescription(request.getDescription());
        }
        if (request.getCategoryId() != null) {
            Category category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new IdInvalidException("Không tìm thấy danh mục"));
            survey.setCategory(category);
        }
        if (request.getStatus() != null) {
            survey.setStatus(request.getStatus());
        }
        if (request.getAiPrompt() != null) {
            survey.setAiPrompt(request.getAiPrompt());
        }

        Survey saved = surveyRepository.save(survey);
        activityLogService.log(
                ActivityLog.ActionType.edit_survey,
                saved.getSurveyId(),
                "surveys",
                "Cập nhật khảo sát: " + saved.getTitle());
        return toSurveyResponseDTO(saved);
        // https://www.facebook.com/groups/?ref=bookmarks
    }

    @Transactional
    public void deleteSurvey(Long surveyId) throws IdInvalidException {
        Survey survey = getSurveyEntityById(surveyId);

        // Kiểm tra quyền
        User currentUser = authService.getCurrentUser();
        if (!survey.getUser().getUserId().equals(currentUser.getUserId())) {
            throw new IdInvalidException("Bạn không có quyền xóa khảo sát này");
        }

        // Cascade delete: Xóa tất cả questions và options thuộc survey này
        List<Question> questions = questionRepository.findBySurvey(survey);
        for (Question question : questions) {
            // Xóa tất cả options của question này
            List<Option> options = optionRepository.findByQuestion(question);
            if (!options.isEmpty()) {
                optionRepository.deleteAll(options);
                activityLogService.log(
                        ActivityLog.ActionType.delete_option,
                        question.getQuestionId(),
                        "options",
                        "Xóa " + options.size() + " tùy chọn khi xóa câu hỏi: " + question.getQuestionText());
            }

            // Log xóa question
            activityLogService.log(
                    ActivityLog.ActionType.delete_question,
                    question.getQuestionId(),
                    "questions",
                    "Xóa câu hỏi khi xóa khảo sát: " + question.getQuestionText());
        }

        // Xóa tất cả questions
        if (!questions.isEmpty()) {
            questionRepository.deleteAll(questions);
        }

        // Cuối cùng xóa survey
        surveyRepository.delete(survey);
        activityLogService.log(
                ActivityLog.ActionType.delete_survey,
                surveyId,
                "surveys",
                "Xóa khảo sát: " + survey.getTitle());
    }

    public long getTotalSurveys() {
        return surveyRepository.count();
    }

    public long getMyTotalSurveys() {
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            return 0;
        }
        return surveyRepository.countByUser(currentUser);
    }

    /**
     * Lưu khảo sát được tạo từ AI vào database
     */
    @Transactional
    public Survey saveAiGeneratedSurvey(User user, Category category,
            vn.duytan.c1se09.smartsurvey.dto.ai.SurveyGenerationRequestDTO request,
            vn.duytan.c1se09.smartsurvey.dto.ai.SurveyGenerationResponseDTO aiResponse) {

        // 1. Tạo Survey entity
        Survey survey = new Survey();
        survey.setUser(user);
        survey.setCategory(category);
        survey.setTitle(aiResponse.getGeneratedSurvey().getTitle());
        survey.setDescription(aiResponse.getGeneratedSurvey().getDescription());
        survey.setAiPrompt(request.getAiPrompt());
        survey.setTargetAudience(request.getTargetAudience()); // Thêm target audience
        survey.setNumberOfQuestions(request.getNumberOfQuestions()); // Thêm số lượng câu hỏi
        survey.setStatus(SurveyStatusEnum.draft); // Sử dụng lowercase

        Survey savedSurvey = surveyRepository.save(survey);

        // 2. Tạo Questions từ AI response
        for (vn.duytan.c1se09.smartsurvey.dto.ai.SurveyGenerationResponseDTO.GeneratedQuestionDTO qDto : aiResponse
                .getGeneratedSurvey().getQuestions()) {

            Question question = new Question();
            question.setSurvey(savedSurvey);
            question.setQuestionText(qDto.getQuestionText());

            // Map question type từ AI format sang enum format
            vn.duytan.c1se09.smartsurvey.util.constant.QuestionTypeEnum questionType;
            switch (qDto.getQuestionType().toUpperCase()) {
                case "SINGLE_CHOICE":
                case "MULTIPLE_CHOICE":
                    questionType = vn.duytan.c1se09.smartsurvey.util.constant.QuestionTypeEnum.multiple_choice;
                    break;
                case "RATING":
                    questionType = vn.duytan.c1se09.smartsurvey.util.constant.QuestionTypeEnum.rating;
                    break;
                case "TEXT":
                default:
                    questionType = vn.duytan.c1se09.smartsurvey.util.constant.QuestionTypeEnum.open_ended;
                    break;
            }
            question.setQuestionType(questionType);

            question.setIsRequired(qDto.isRequired());
            question.setDisplayOrder(qDto.getDisplayOrder());

            Question savedQuestion = questionRepository.save(question);

            // 3. Tạo Options nếu có
            if (qDto.getOptions() != null && !qDto.getOptions().isEmpty()) {
                for (vn.duytan.c1se09.smartsurvey.dto.ai.SurveyGenerationResponseDTO.GeneratedOptionDTO oDto : qDto
                        .getOptions()) {

                    Option option = new Option();
                    option.setQuestion(savedQuestion);
                    option.setOptionText(oDto.getOptionText());
                    // Option entity không có displayOrder field, chỉ lưu text
                    optionRepository.save(option);
                }
            }
        }

        // 4. Log activity sử dụng existing method
        activityLogService.log(
                ActivityLog.ActionType.ai_generate,
                savedSurvey.getSurveyId(),
                "surveys",
                "Tạo khảo sát từ AI: " + savedSurvey.getTitle());

        return savedSurvey;
    }
}