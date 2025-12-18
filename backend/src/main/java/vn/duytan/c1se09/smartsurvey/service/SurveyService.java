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
import vn.duytan.c1se09.smartsurvey.util.constant.SurveyPermissionRole;

import java.util.List;
import java.util.Map;
import java.util.HashMap;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import vn.duytan.c1se09.smartsurvey.domain.response.survey.SurveyFetchResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.survey.SurveyPaginationDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.survey.SurveyPublicResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.survey.SurveyStatusResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.survey.SurveyPermissionUpdateRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.survey.SurveyPermissionResponseDTO;

/**
 * Service xử lý logic business cho Survey
 */
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class SurveyService {
    private final SurveyRepository surveyRepository;
    private final CategoryRepository categoryRepository;
    private final QuestionRepository questionRepository;
    private final OptionRepository optionRepository;
    private final AnswerRepository answerRepository;
    private final ResponseRepository responseRepository;
    private final SurveyViewRepository surveyViewRepository;
    private final AiSentimentRepository aiSentimentRepository;
    private final AiAnalysisRepository aiAnalysisRepository;
    private final AuthService authService;
    private final ActivityLogService activityLogService;
    private final SurveyPermissionService surveyPermissionService;
    private final SurveyPermissionRepository surveyPermissionRepository;
    private final AiChatLogRepository aiChatLogRepository;
    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;

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
    public Survey updateSurvey(Survey survey) throws IdInvalidException {
        // Kiểm tra quyền trước khi update
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new IdInvalidException("Người dùng chưa xác thực");
        }
        
        // Check permission: chỉ OWNER và EDITOR mới được cập nhật survey
        if (!surveyPermissionService.canEdit(survey, currentUser)) {
            throw new IdInvalidException("Bạn không có quyền chỉnh sửa khảo sát này");
        }
        
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
        // Include owned + shared + team surveys
        List<Survey> surveys = surveyPermissionRepository.findSurveysAccessibleByUser(currentUser);
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
        // Use accessible surveys query to include owned + shared + team surveys
        Page<Survey> surveyPage = surveyRepository.findAccessibleSurveysByUser(currentUser, pageable);
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
        
        // Kiểm tra quyền xem survey
        User currentUser = authService.getCurrentUser();
        if (!surveyPermissionService.canViewSurvey(survey, currentUser)) {
            throw new IdInvalidException("Bạn không có quyền xem khảo sát này");
        }
        
        return toSurveyResponseDTO(survey);
    }

    /**
     * Lấy chi tiết survey với questions và options đầy đủ
     */
    public SurveyDetailResponseDTO getSurveyByIdWithDetails(Long surveyId) throws IdInvalidException {
        Survey survey = getSurveyEntityById(surveyId);

        // Kiểm tra quyền truy cập (check permissions, not just owner)
        User currentUser = authService.getCurrentUser();
        if (surveyPermissionService.getUserPermission(survey, currentUser) == null) {
            throw new IdInvalidException("Bạn không có quyền xem khảo sát này");
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
        if (!surveyPermissionService.canEdit(survey, currentUser)) {
            throw new IdInvalidException("Bạn không có quyền cập nhật khảo sát này");
        }
        survey.setStatus(status);
        return surveyRepository.save(survey);
    }

    @Transactional
    public SurveyResponseDTO updateSurvey(Long surveyId, SurveyUpdateRequestDTO request) throws IdInvalidException {
        Survey survey = getSurveyEntityById(surveyId);
        User currentUser = authService.getCurrentUser();
        if (!surveyPermissionService.canEdit(survey, currentUser)) {
            throw new IdInvalidException("Bạn không có quyền chỉnh sửa khảo sát này");
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
        
    }

    @Transactional
    public void deleteSurvey(Long surveyId) throws IdInvalidException {
        Survey survey = getSurveyEntityById(surveyId);

        // Kiểm tra quyền (chỉ OWNER mới được xóa)
        User currentUser = authService.getCurrentUser();
        if (!surveyPermissionService.canDelete(survey, currentUser)) {
            throw new IdInvalidException("Chỉ chủ sở hữu mới có thể xóa khảo sát");
        }

        // BƯỚC 1: Xóa tất cả Answers trước (tham chiếu Response và Question)
        List<Response> responses = responseRepository.findBySurvey(survey);
        for (Response response : responses) {
            List<Answer> answers = answerRepository.findByResponse(response);
            if (!answers.isEmpty()) {
                answerRepository.deleteAll(answers);
            }
        }

        // BƯỚC 2: Xóa tất cả Responses (tham chiếu Survey)
        if (!responses.isEmpty()) {
            responseRepository.deleteAll(responses);
        }

        // BƯỚC 3: Xóa tất cả Options và Questions
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

        // BƯỚC 4: Xóa SurveyPermission (tham chiếu Survey)
        List<SurveyPermission> permissions = surveyPermissionRepository.findBySurvey(survey);
        if (!permissions.isEmpty()) {
            surveyPermissionRepository.deleteAll(permissions);
        }

        // BƯỚC 5: Xóa SurveyView (tham chiếu Survey)
        List<SurveyView> views = surveyViewRepository.findBySurveyOrderByViewedAtDesc(survey);
        if (!views.isEmpty()) {
            surveyViewRepository.deleteAll(views);
        }

        // BƯỚC 6: Xóa AiSentiment (tham chiếu Survey)
        List<AiSentiment> sentiments = aiSentimentRepository.findBySurvey(survey);
        if (!sentiments.isEmpty()) {
            aiSentimentRepository.deleteAll(sentiments);
        }

        // BƯỚC 7: Xóa AiAnalysis (tham chiếu Survey)
        List<AiAnalysis> analyses = aiAnalysisRepository.findBySurvey(survey);
        if (!analyses.isEmpty()) {
            aiAnalysisRepository.deleteAll(analyses);
        }

        // BƯỚC 8: Xóa AiChatLogs (tham chiếu Survey)
        List<AiChatLog> chatLogs = aiChatLogRepository.findBySurvey(survey);
        if (!chatLogs.isEmpty()) {
            aiChatLogRepository.deleteAll(chatLogs);
        }

        // BƯỚC 9: Cuối cùng xóa survey
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
            vn.duytan.c1se09.smartsurvey.domain.request.ai.SurveyGenerationRequestDTO request,
            vn.duytan.c1se09.smartsurvey.domain.response.ai.SurveyGenerationResponseDTO aiResponse) {

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
        for (vn.duytan.c1se09.smartsurvey.domain.response.ai.SurveyGenerationResponseDTO.GeneratedQuestionDTO qDto : aiResponse
                .getGeneratedSurvey().getQuestions()) {

            Question question = new Question();
            question.setSurvey(savedSurvey);
            question.setQuestionText(qDto.getQuestionText());
            
            // Log để debug
            System.out.println("🔍 [DEBUG] Mapping question type from AI: " + qDto.getQuestionType());

            // Map question type từ AI format sang enum format
            vn.duytan.c1se09.smartsurvey.util.constant.QuestionTypeEnum questionType;
            String aiQuestionType = qDto.getQuestionType().toLowerCase().replace("-", "_");
            
            switch (aiQuestionType) {
                case "single_choice":
                    questionType = vn.duytan.c1se09.smartsurvey.util.constant.QuestionTypeEnum.single_choice;
                    break;
                case "multiple_choice":
                    questionType = vn.duytan.c1se09.smartsurvey.util.constant.QuestionTypeEnum.multiple_choice;
                    break;
                case "rating":
                    questionType = vn.duytan.c1se09.smartsurvey.util.constant.QuestionTypeEnum.rating;
                    break;
                case "ranking":
                    questionType = vn.duytan.c1se09.smartsurvey.util.constant.QuestionTypeEnum.ranking;
                    break;
                case "boolean":
                case "boolean_":
                case "yes_no":
                    questionType = vn.duytan.c1se09.smartsurvey.util.constant.QuestionTypeEnum.boolean_;
                    break;
                case "date_time":
                case "date":
                case "datetime":
                    questionType = vn.duytan.c1se09.smartsurvey.util.constant.QuestionTypeEnum.date_time;
                    break;
                case "file_upload":
                case "file":
                case "upload":
                    questionType = vn.duytan.c1se09.smartsurvey.util.constant.QuestionTypeEnum.file_upload;
                    break;
                case "open_ended":
                case "text":
                case "short_text":
                default:
                    questionType = vn.duytan.c1se09.smartsurvey.util.constant.QuestionTypeEnum.open_ended;
                    break;
            }
            
            // Log kết quả mapping
            System.out.println("✅ [DEBUG] Mapped to DB type: " + questionType.name());
            
            question.setQuestionType(questionType);

            question.setIsRequired(qDto.isRequired());
            question.setDisplayOrder(qDto.getDisplayOrder());

            Question savedQuestion = questionRepository.save(question);

            // 3. Tạo Options nếu có
            if (qDto.getOptions() != null && !qDto.getOptions().isEmpty()) {
                for (vn.duytan.c1se09.smartsurvey.domain.response.ai.SurveyGenerationResponseDTO.GeneratedOptionDTO oDto : qDto
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

    /**
     * Lấy thông tin survey công khai để người dùng trả lời (không cần
     * authentication)
     * Chỉ trả về thông tin cần thiết, không có AI prompt hay thông tin user
     */
    public SurveyPublicResponseDTO getSurveyPublic(Long surveyId) throws IdInvalidException {
        Survey survey = getSurveyEntityById(surveyId);

        // Kiểm tra survey có active không
        if (survey.getStatus() != SurveyStatusEnum.published) {
            throw new IdInvalidException("Khảo sát không khả dụng để trả lời");
        }

        SurveyPublicResponseDTO dto = new SurveyPublicResponseDTO();
        dto.setId(survey.getSurveyId());
        dto.setTitle(survey.getTitle());
        dto.setDescription(survey.getDescription());
        dto.setStatus(survey.getStatus() != null ? survey.getStatus().name() : null);
        dto.setCreatedAt(survey.getCreatedAt());
        dto.setUpdatedAt(survey.getUpdatedAt());

        // Chỉ trả về category name, không có category ID
        if (survey.getCategory() != null) {
            dto.setCategoryName(survey.getCategory().getCategoryName());
        }

        // Lấy danh sách questions với options (public version)
        List<Question> questions = questionRepository.findBySurveyOrderByDisplayOrderAsc(survey);
        List<SurveyPublicResponseDTO.QuestionPublicDTO> questionDTOs = questions.stream().map(question -> {
            SurveyPublicResponseDTO.QuestionPublicDTO qDto = new SurveyPublicResponseDTO.QuestionPublicDTO();
            qDto.setId(question.getQuestionId());
            qDto.setText(question.getQuestionText());
            qDto.setType(question.getQuestionType().name().toLowerCase());
            qDto.setRequired(question.getIsRequired());
            qDto.setOrder(question.getDisplayOrder());

            // Lấy options cho question này
            List<Option> options = optionRepository.findByQuestion(question);
            List<SurveyPublicResponseDTO.OptionPublicDTO> optionDTOs = options.stream().map(option -> {
                SurveyPublicResponseDTO.OptionPublicDTO oDto = new SurveyPublicResponseDTO.OptionPublicDTO();
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

    /**
     * Kiểm tra trạng thái survey có thể trả lời không
     */
    public SurveyStatusResponseDTO checkSurveyStatus(Long surveyId) {
        try {
            Survey survey = getSurveyEntityById(surveyId);

            if (survey.getStatus() == SurveyStatusEnum.published) {
                return SurveyStatusResponseDTO.builder()
                        .status("active")
                        .message("Khảo sát đang hoạt động và có thể trả lời")
                        .surveyId(survey.getSurveyId())
                        .title(survey.getTitle())
                        .build();
            } else if (survey.getStatus() == SurveyStatusEnum.draft) {
                return SurveyStatusResponseDTO.builder()
                        .status("closed")
                        .message("Khảo sát đang ở trạng thái nháp, chưa được xuất bản")
                        .surveyId(survey.getSurveyId())
                        .title(survey.getTitle())
                        .build();
            } else if (survey.getStatus() == SurveyStatusEnum.archived) {
                return SurveyStatusResponseDTO.builder()
                        .status("closed")
                        .message("Khảo sát đã được lưu trữ")
                        .surveyId(survey.getSurveyId())
                        .title(survey.getTitle())
                        .build();
            } else {
                return SurveyStatusResponseDTO.builder()
                        .status("closed")
                        .message("Khảo sát không khả dụng")
                        .surveyId(survey.getSurveyId())
                        .title(survey.getTitle())
                        .build();
            }

        } catch (IdInvalidException e) {
            return SurveyStatusResponseDTO.builder()
                    .status("not_found")
                    .message("Không tìm thấy khảo sát với ID: " + surveyId)
                    .surveyId(surveyId)
                    .build();
        }
    }

    @Transactional
    public SurveyPermissionResponseDTO updateSurveyPermissions(Long surveyId, SurveyPermissionUpdateRequestDTO request)
            throws IdInvalidException {
        Survey survey = getSurveyEntityById(surveyId);
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new IdInvalidException("Người dùng chưa xác thực");
        }
        if (!surveyPermissionService.canManagePermissions(survey, currentUser)) {
            throw new IdInvalidException("Bạn không có quyền quản lý quyền truy cập của khảo sát này");
        }
       

        // Map để lưu thông tin user permissions với restrictedTeamId
        // Key: userId, Value: Pair<permission, restrictedTeamId>
        Map<Long, java.util.AbstractMap.SimpleEntry<SurveyPermissionRole, Long>> requestedUserPermissions = new HashMap<>();
        Map<Long, User> loadedUsers = new HashMap<>();
        Map<Long, Team> loadedRestrictedTeams = new HashMap<>();

        // Parse teamAccess format: [{"userId": 456, "restrictedTeamId": 1, "permission": "..."}]
        if (request.getTeamAccess() != null) {
            for (SurveyPermissionUpdateRequestDTO.TeamAccessDTO dto : request.getTeamAccess()) {
                if (dto.getUserId() == null && dto.getEmail() == null) {
                    throw new IdInvalidException("teamAccess item phải có userId hoặc email");
                }

                // Xử lý email nếu có
                User targetUser;
                if (dto.getUserId() != null) {
                    targetUser = userRepository.findById(dto.getUserId())
                            .orElseThrow(() -> new IdInvalidException("Không tìm thấy user với id: " + dto.getUserId()));
                } else {
                    targetUser = userRepository.findByEmail(dto.getEmail().trim().toLowerCase())
                            .orElseThrow(() -> new IdInvalidException("Không tìm thấy user với email: " + dto.getEmail()));
                }

                // User access
                if (targetUser.getUserId().equals(survey.getUser().getUserId())) {
                    // Chủ sở hữu đã có toàn quyền, bỏ qua để tránh lỗi unique constraint
                    continue;
                }

                // Không cho phép gán quyền OWNER cho user không phải chủ sở hữu survey
                if (dto.getPermission() == SurveyPermissionRole.OWNER) {
                    throw new IdInvalidException(
                            "Không thể gán quyền OWNER cho user không phải chủ sở hữu survey");
                }

                // Validate restrictedTeamId nếu có
                Team restrictedTeam = null;
                if (dto.getRestrictedTeamId() != null) {
                    restrictedTeam = teamRepository.findById(dto.getRestrictedTeamId())
                            .orElseThrow(() -> new IdInvalidException("Không tìm thấy team với id: " + dto.getRestrictedTeamId()));
                    
                    // Kiểm tra user có phải member của restricted team không
                    boolean isMember = teamMemberRepository.existsByTeamAndUser(restrictedTeam, targetUser);
                    if (!isMember) {
                        throw new IdInvalidException("User " + targetUser.getEmail() + " không phải thành viên của team " + restrictedTeam.getName());
                    }
                    
                    loadedRestrictedTeams.put(dto.getRestrictedTeamId(), restrictedTeam);
                }

                requestedUserPermissions.put(targetUser.getUserId(), 
                    new java.util.AbstractMap.SimpleEntry<>(dto.getPermission(), dto.getRestrictedTeamId()));
                loadedUsers.put(targetUser.getUserId(), targetUser);
            }
        }

        List<SurveyPermission> existingPermissions = surveyPermissionRepository.findBySurvey(survey);
        // Map để track processed permissions: userId -> (permission, restrictedTeamId)
        Map<Long, java.util.AbstractMap.SimpleEntry<SurveyPermissionRole, Long>> processedPermissions = new HashMap<>();
        // Map để track các user bị xóa permission trong request này: userId -> oldPermission
        Map<Long, SurveyPermission> deletedPermissions = new HashMap<>();

        for (SurveyPermission permission : existingPermissions) {
            if (permission.getUser() != null) {
                Long userId = permission.getUser().getUserId();
                java.util.AbstractMap.SimpleEntry<SurveyPermissionRole, Long> requested = requestedUserPermissions.get(userId);
                
                if (requested == null) {
                    // Permission không còn trong request, xóa và lưu lại để track
                    deletedPermissions.put(userId, permission);
                    surveyPermissionRepository.delete(permission);
                } else {
                    // Kiểm tra xem có thay đổi permission hoặc restrictedTeamId không
                    SurveyPermissionRole oldPermission = permission.getPermission();
                    boolean permissionChanged = !oldPermission.equals(requested.getKey());
                    Long currentRestrictedTeamId = permission.getRestrictedTeam() != null ? permission.getRestrictedTeam().getTeamId() : null;
                    boolean restrictedTeamChanged = !java.util.Objects.equals(currentRestrictedTeamId, requested.getValue());
                    
                    if (permissionChanged || restrictedTeamChanged) {
                        // Lưu thông tin team cũ để gửi notification
                        Team oldRestrictedTeam = permission.getRestrictedTeam();
                        String oldTeamName = oldRestrictedTeam != null ? oldRestrictedTeam.getName() : null;
                        
                        permission.setPermission(requested.getKey());
                        if (requested.getValue() != null) {
                            permission.setRestrictedTeam(loadedRestrictedTeams.get(requested.getValue()));
                        } else {
                            permission.setRestrictedTeam(null);
                        }
                        permission.setGrantedBy(currentUser);
                        surveyPermissionRepository.save(permission);
                        
                        // Quyền đã thay đổi, gửi notification
                        User targetUser = permission.getUser();
                        if (targetUser == null) {
                            targetUser = loadedUsers.get(userId);
                        }
                        String notificationMessage;
                        
                        if (permissionChanged && restrictedTeamChanged) {
                            // Cả permission và team đều thay đổi
                            String newTeamName = permission.getRestrictedTeam() != null ? permission.getRestrictedTeam().getName() : null;
                            String oldTeamInfo = oldTeamName != null ? " (team " + oldTeamName + ")" : "";
                            String newTeamInfo = newTeamName != null ? " (team " + newTeamName + ")" : "";
                            notificationMessage = String.format("Quyền của bạn trên survey '%s' đã được %s thay đổi từ %s%s sang %s%s",
                                    survey.getTitle(), currentUser.getFullName(),
                                    oldPermission.name(), oldTeamInfo,
                                    requested.getKey().name(), newTeamInfo);
                        } else if (permissionChanged) {
                            // Chỉ permission thay đổi
                            notificationMessage = String.format("Quyền của bạn trên survey '%s' đã được %s thay đổi từ %s sang %s",
                                    survey.getTitle(), currentUser.getFullName(),
                                    oldPermission.name(), requested.getKey().name());
                        } else {
                            // Chỉ team thay đổi
                            String newTeamName = permission.getRestrictedTeam() != null ? permission.getRestrictedTeam().getName() : null;
                            String oldTeamInfo = oldTeamName != null ? "team " + oldTeamName : "không giới hạn";
                            String newTeamInfo = newTeamName != null ? "team " + newTeamName : "không giới hạn";
                            notificationMessage = String.format("Phạm vi quyền %s của bạn trên survey '%s' đã được %s thay đổi từ %s sang %s",
                                    requested.getKey().name(), survey.getTitle(), currentUser.getFullName(),
                                    oldTeamInfo, newTeamInfo);
                        }
                        
                        try {
                            notificationService.createNotification(
                                    targetUser,
                                    Notification.NotificationType.SURVEY_PERMISSION_CHANGED,
                                    "Quyền truy cập survey đã thay đổi",
                                    notificationMessage,
                                    "survey",
                                    survey.getSurveyId()
                            );
                        } catch (Exception e) {
                            // Log lỗi nhưng không throw để không ảnh hưởng đến việc cập nhật permission
                            System.err.println("Lỗi khi gửi notification khi cập nhật permission: " + e.getMessage());
                            e.printStackTrace();
                        }
                    }
                    processedPermissions.put(userId, requested);
                }
            }
        }

        for (Map.Entry<Long, java.util.AbstractMap.SimpleEntry<SurveyPermissionRole, Long>> entry : requestedUserPermissions.entrySet()) {
            Long userId = entry.getKey();
            SurveyPermissionRole permission = entry.getValue().getKey();
            Long restrictedTeamId = entry.getValue().getValue();
            
            if (processedPermissions.containsKey(userId)) {
                // Permission đã tồn tại và được xử lý ở trên (notification đã được gửi nếu có thay đổi)
                continue;
            }
            
            // Kiểm tra xem user này có vừa bị xóa permission trong request này không
            SurveyPermission deletedPermission = deletedPermissions.get(userId);
            User targetUser = loadedUsers.get(userId);
            
            // Đảm bảo targetUser không null
            if (targetUser == null) {
                // Nếu không có trong loadedUsers, load từ database
                targetUser = userRepository.findById(userId)
                        .orElseThrow(() -> new IdInvalidException("Không tìm thấy user với id: " + userId));
            }
            
            // Permission mới, tạo
            SurveyPermission newPermission = new SurveyPermission();
            newPermission.setSurvey(survey);
            newPermission.setUser(targetUser);
            newPermission.setPermission(permission);
            if (restrictedTeamId != null) {
                newPermission.setRestrictedTeam(loadedRestrictedTeams.get(restrictedTeamId));
            }
            newPermission.setGrantedBy(currentUser);
            surveyPermissionRepository.save(newPermission);
            
            // Gửi notification - LUÔN gửi khi thêm permission mới
            if (deletedPermission != null) {
                // User này vừa bị xóa và được thêm lại - coi như permission thay đổi
                SurveyPermissionRole oldPermission = deletedPermission.getPermission();
                Team oldRestrictedTeam = deletedPermission.getRestrictedTeam();
                String oldTeamName = oldRestrictedTeam != null ? oldRestrictedTeam.getName() : null;
                
                boolean permissionChanged = !oldPermission.equals(permission);
                Long oldRestrictedTeamId = oldRestrictedTeam != null ? oldRestrictedTeam.getTeamId() : null;
                boolean restrictedTeamChanged = !java.util.Objects.equals(oldRestrictedTeamId, restrictedTeamId);
                
                String notificationMessage;
                if (permissionChanged && restrictedTeamChanged) {
                    // Cả permission và team đều thay đổi
                    String newTeamName = restrictedTeamId != null && loadedRestrictedTeams.containsKey(restrictedTeamId) 
                        ? loadedRestrictedTeams.get(restrictedTeamId).getName() : null;
                    String oldTeamInfo = oldTeamName != null ? " (team " + oldTeamName + ")" : "";
                    String newTeamInfo = newTeamName != null ? " (team " + newTeamName + ")" : "";
                    notificationMessage = String.format("Quyền của bạn trên survey '%s' đã được %s thay đổi từ %s%s sang %s%s",
                            survey.getTitle(), currentUser.getFullName(),
                            oldPermission.name(), oldTeamInfo,
                            permission.name(), newTeamInfo);
                } else if (permissionChanged) {
                    // Chỉ permission thay đổi
                    notificationMessage = String.format("Quyền của bạn trên survey '%s' đã được %s thay đổi từ %s sang %s",
                            survey.getTitle(), currentUser.getFullName(),
                            oldPermission.name(), permission.name());
                } else if (restrictedTeamChanged) {
                    // Chỉ team thay đổi
                    String newTeamName = restrictedTeamId != null && loadedRestrictedTeams.containsKey(restrictedTeamId) 
                        ? loadedRestrictedTeams.get(restrictedTeamId).getName() : null;
                    String oldTeamInfo = oldTeamName != null ? "team " + oldTeamName : "không giới hạn";
                    String newTeamInfo = newTeamName != null ? "team " + newTeamName : "không giới hạn";
                    notificationMessage = String.format("Phạm vi quyền %s của bạn trên survey '%s' đã được %s thay đổi từ %s sang %s",
                            permission.name(), survey.getTitle(), currentUser.getFullName(),
                            oldTeamInfo, newTeamInfo);
                } else {
                    // Permission và team giống nhau - khôi phục quyền
                    String teamInfo = restrictedTeamId != null && loadedRestrictedTeams.containsKey(restrictedTeamId) 
                        ? " (giới hạn cho team " + loadedRestrictedTeams.get(restrictedTeamId).getName() + ")" : "";
                    notificationMessage = String.format("Quyền %s của bạn trên survey '%s' đã được %s khôi phục%s",
                            permission.name(), survey.getTitle(), currentUser.getFullName(), teamInfo);
                }
                
                try {
                    notificationService.createNotification(
                            targetUser,
                            Notification.NotificationType.SURVEY_PERMISSION_CHANGED,
                            "Quyền truy cập survey đã thay đổi",
                            notificationMessage,
                            "survey",
                            survey.getSurveyId()
                    );
                } catch (Exception e) {
                    // Log lỗi nhưng không throw để không ảnh hưởng đến việc cập nhật permission
                    System.err.println("Lỗi khi gửi notification: " + e.getMessage());
                    e.printStackTrace();
                }
            } else {
                // User mới hoàn toàn, gửi notification SURVEY_SHARED
                String teamInfo = restrictedTeamId != null && loadedRestrictedTeams.containsKey(restrictedTeamId) 
                    ? " (giới hạn cho team " + loadedRestrictedTeams.get(restrictedTeamId).getName() + ")" : "";
                try {
                    notificationService.createNotification(
                            targetUser,
                            Notification.NotificationType.SURVEY_SHARED,
                            "Survey được chia sẻ với bạn",
                            String.format("%s đã chia sẻ survey '%s' với bạn với quyền %s%s",
                                    currentUser.getFullName(), survey.getTitle(), permission.name(), teamInfo),
                            "survey",
                            survey.getSurveyId()
                    );
                } catch (Exception e) {
                    // Log lỗi nhưng không throw để không ảnh hưởng đến việc cập nhật permission
                    System.err.println("Lỗi khi gửi notification: " + e.getMessage());
                    e.printStackTrace();
                }
            }
        }

        // Flush để đảm bảo tất cả changes được commit trước khi query lại
        surveyPermissionRepository.flush();
        
        // Reload permissions để đảm bảo trạng thái mới nhất
        List<SurveyPermission> updatedPermissions = surveyPermissionRepository.findBySurvey(survey);
        return buildSurveyPermissionResponse(survey, updatedPermissions);
    }

    private SurveyPermissionResponseDTO buildSurveyPermissionResponse(Survey survey,
            List<SurveyPermission> permissions) {
        List<SurveyPermissionResponseDTO.SharedUserDTO> userShares = permissions.stream()
                .filter(p -> p.getUser() != null)
                .map(p -> {
                    SurveyPermissionResponseDTO.SharedUserDTO.SharedUserDTOBuilder builder = SurveyPermissionResponseDTO.SharedUserDTO.builder()
                            .userId(p.getUser().getUserId())
                            .email(p.getUser().getEmail())
                            .fullName(p.getUser().getFullName())
                            .permission(p.getPermission())
                            .grantedBy(p.getGrantedBy() != null ? p.getGrantedBy().getUserId() : null)
                            .grantedByName(
                                    p.getGrantedBy() != null ? p.getGrantedBy().getFullName() : null)
                            .updatedAt(p.getUpdatedAt());
                    
                    // Thêm thông tin restricted team nếu có
                    if (p.getRestrictedTeam() != null) {
                        builder.restrictedTeamId(p.getRestrictedTeam().getTeamId())
                               .restrictedTeamName(p.getRestrictedTeam().getName());
                    }
                    
                    return builder.build();
                })
                .toList();

        return SurveyPermissionResponseDTO.builder()
                .surveyId(survey.getSurveyId())
                .users(userShares)
                .warnings(java.util.Collections.emptyList())
                .build();
    }
}