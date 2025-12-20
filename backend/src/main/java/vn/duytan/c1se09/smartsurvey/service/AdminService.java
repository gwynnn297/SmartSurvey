package vn.duytan.c1se09.smartsurvey.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.duytan.c1se09.smartsurvey.domain.*;
import vn.duytan.c1se09.smartsurvey.domain.request.UserRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.UserResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.admin.*;
import vn.duytan.c1se09.smartsurvey.repository.*;
import vn.duytan.c1se09.smartsurvey.util.constant.RoleEnum;
import vn.duytan.c1se09.smartsurvey.util.constant.SurveyStatusEnum;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Service xử lý logic admin
 */
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class AdminService {
    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;
    private final SurveyRepository surveyRepository;
    private final ResponseRepository responseRepository;
    private final QuestionRepository questionRepository;
    private final CategoryRepository categoryRepository;
    private final NotificationRepository notificationRepository;
    private final ActivityLogRepository activityLogRepository;
    private final SurveyViewRepository surveyViewRepository;
    private final SurveyPermissionRepository surveyPermissionRepository;
    private final OptionRepository optionRepository;
    private final AnswerRepository answerRepository;
    private final AiSentimentRepository aiSentimentRepository;
    private final AiAnalysisRepository aiAnalysisRepository;
    private final AiChatLogRepository aiChatLogRepository;
    private final ActivityLogService activityLogService;
    private final AuthService authService;
    private final PasswordEncoder passwordEncoder;

    /**
     * Kiểm tra quyền admin
     */
    private void validateAdminRole() throws IdInvalidException {
        User currentUser = authService.getCurrentUser();
        if (currentUser == null || currentUser.getRole() != RoleEnum.admin) {
            throw new IdInvalidException("Chỉ admin mới có quyền truy cập");
        }
    }

    /**
     * Lấy dashboard tổng quan hệ thống
     */
    public AdminDashboardDTO getDashboard() throws IdInvalidException {
        validateAdminRole();
        
        // User statistics
        long totalUsers = userRepository.count();
        long totalAdmins = userRepository.countByRole(RoleEnum.admin);
        long totalCreators = userRepository.countByRole(RoleEnum.creator);
        long totalRespondents = userRepository.countByRole(RoleEnum.respondent);
        long activeUsers = userRepository.findAll().stream()
                .filter(User::getIsActive)
                .count();
        
        // Survey statistics
        long totalSurveys = surveyRepository.count();
        long draftSurveys = surveyRepository.countByStatus(SurveyStatusEnum.draft);
        long publishedSurveys = surveyRepository.countByStatus(SurveyStatusEnum.published);
        long archivedSurveys = surveyRepository.countByStatus(SurveyStatusEnum.archived);
        
        // Other statistics
        long totalResponses = responseRepository.count();
        long totalQuestions = questionRepository.count();
        long totalCategories = categoryRepository.count();
        
        // Lấy 10 admin activities gần nhất từ ActivityLog (audit logs)
        List<ActivityLog.ActionType> adminActionTypes = Arrays.asList(
            ActivityLog.ActionType.admin_update_user_role,
            ActivityLog.ActionType.admin_delete_user,
            ActivityLog.ActionType.admin_create_user,
            ActivityLog.ActionType.admin_deactivate_user,
            ActivityLog.ActionType.admin_activate_user
        );
        Page<ActivityLog> adminActivityLogs = activityLogRepository.findByActionTypeIn(
            adminActionTypes, 
            PageRequest.of(0, 10)
        );
        
        List<AdminDashboardDTO.AdminActivityDTO> recentActivities = adminActivityLogs.getContent().stream()
                .map(log -> {
                    // Lấy thông tin admin (user thực hiện hành động)
                    Long adminUserId = log.getUser() != null ? log.getUser().getUserId() : null;
                    String adminName = log.getUser() != null ? log.getUser().getFullName() : null;
                    
                    // Lấy thông tin user bị thao tác từ targetId
                    Long targetUserId = log.getTargetId();
                    String targetUserName = null;
                    String targetUserEmail = null;
                    if (targetUserId != null && log.getTargetTable() != null && log.getTargetTable().equals("users")) {
                        Optional<User> targetUser = userRepository.findById(targetUserId);
                        if (targetUser.isPresent()) {
                            User u = targetUser.get();
                            targetUserName = u.getFullName();
                            targetUserEmail = u.getEmail();
                        }
                    }
                    
                    AdminDashboardDTO.AdminActivityDTO dto = AdminDashboardDTO.AdminActivityDTO.builder()
                            .notificationId(null) // Không có notificationId nữa
                            .userId(targetUserId) // Target ID là userId của user bị thao tác
                            .userName(targetUserName)
                            .userEmail(targetUserEmail)
                            .adminUserId(adminUserId)
                            .adminName(adminName)
                            .type(log.getActionType().name())
                            .title(null) // Không có title trong ActivityLog
                            .message(log.getDescription())
                            .createdAt(log.getCreatedAt())
                            .build();
                    
                    return dto;
                })
                .collect(Collectors.toList());
        
        return AdminDashboardDTO.builder()
                .totalUsers(totalUsers)
                .totalAdmins(totalAdmins)
                .totalCreators(totalCreators)
                .totalRespondents(totalRespondents)
                .activeUsers(activeUsers)
                .totalSurveys(totalSurveys)
                .draftSurveys(draftSurveys)
                .publishedSurveys(publishedSurveys)
                .archivedSurveys(archivedSurveys)
                .totalResponses(totalResponses)
                .totalQuestions(totalQuestions)
                .totalCategories(totalCategories)
                .recentAdminActivities(recentActivities)
                .build();
    }

    /**
     * Lấy danh sách users với phân trang và filter
     */
    public AdminUserPageDTO getUsers(int page, int size, String search, String role, Boolean isActive) throws IdInvalidException {
        validateAdminRole();
        
        Pageable pageable = PageRequest.of(page, size);
        RoleEnum roleEnum = null;
            if (role != null && !role.isEmpty()) {
                try {
                roleEnum = RoleEnum.valueOf(role.toLowerCase());
                } catch (IllegalArgumentException e) {
                // Invalid role, ignore
                }
            }
            
        Page<User> userPage = userRepository.findUsersWithFilters(search, roleEnum, isActive, pageable);
        
        List<AdminUserPageDTO.UserDTO> userDTOs = userPage.getContent().stream()
                .map(user -> AdminUserPageDTO.UserDTO.builder()
                        .userId(user.getUserId())
                        .fullName(user.getFullName())
                        .email(user.getEmail())
                        .role(user.getRole().name())
                        .isActive(user.getIsActive())
                        .createdAt(user.getCreatedAt())
                        .updatedAt(user.getUpdatedAt())
                        .build())
                .collect(Collectors.toList());
        
        return AdminUserPageDTO.builder()
                .users(userDTOs)
                .totalElements(userPage.getTotalElements())
                .totalPages(userPage.getTotalPages())
                .currentPage(page)
                .pageSize(size)
                .build();
    }

    /**
     * Lấy chi tiết user
     */
    public AdminUserDetailDTO getUserDetail(Long userId) throws IdInvalidException {
        validateAdminRole();
        
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy user"));
        
        // Lấy profile
        Optional<UserProfile> profileOpt = userProfileRepository.findByUserId(userId);
        AdminUserDetailDTO.UserProfileDTO profileDTO = null;
        if (profileOpt.isPresent()) {
            UserProfile profile = profileOpt.get();
            profileDTO = AdminUserDetailDTO.UserProfileDTO.builder()
                    .gender(profile.getGender())
                    .ageBand(profile.getAgeBand())
                    .region(profile.getRegion())
                    .build();
        }
        
        // Statistics
        long surveysCount = surveyRepository.countByUser(user);
        long responsesCount = responseRepository.findByUser(user).size();
        
        // Lần đăng nhập cuối
        List<ActivityLog> loginLogs = activityLogRepository.findByUserAndActionTypeOrderByCreatedAtDesc(
            user, 
            ActivityLog.ActionType.login
        );
        LocalDateTime lastLogin = loginLogs.isEmpty() ? null : loginLogs.get(0).getCreatedAt();
        
        // Recent admin activities for this user từ ActivityLog
        List<ActivityLog.ActionType> adminActionTypes = Arrays.asList(
            ActivityLog.ActionType.admin_update_user_role,
            ActivityLog.ActionType.admin_delete_user,
            ActivityLog.ActionType.admin_create_user,
            ActivityLog.ActionType.admin_deactivate_user,
            ActivityLog.ActionType.admin_activate_user
        );
        // Query ActivityLog với targetId = userId và actionType trong danh sách admin actions
        Page<ActivityLog> adminActivityLogPage = activityLogRepository.findByTargetUserAndActionTypeIn(
            userId,
            adminActionTypes,
            PageRequest.of(0, 10)
        );
        List<ActivityLog> adminActivityLogs = adminActivityLogPage.getContent();
        
        List<AdminUserDetailDTO.AdminActivityDTO> recentAdminActivities = adminActivityLogs.stream()
                .map(log -> AdminUserDetailDTO.AdminActivityDTO.builder()
                        .notificationId(null) // Không có notificationId nữa
                        .type(log.getActionType().name())
                        .title(null) // Không có title trong ActivityLog
                        .message(log.getDescription())
                        .createdAt(log.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
        
        // Recent user activities
        List<ActivityLog> userActivities = activityLogRepository.findByUserOrderByCreatedAtDesc(user)
                .stream()
                .limit(10)
                .collect(Collectors.toList());
        
        List<AdminUserDetailDTO.UserActivityDTO> recentUserActivities = userActivities.stream()
                .map(log -> AdminUserDetailDTO.UserActivityDTO.builder()
                        .logId(log.getLogId())
                        .actionType(log.getActionType().name())
                        .description(log.getDescription())
                        .targetId(log.getTargetId())
                        .targetTable(log.getTargetTable())
                        .createdAt(log.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
        
        return AdminUserDetailDTO.builder()
                .userId(user.getUserId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .role(user.getRole().name())
                .isActive(user.getIsActive())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .profile(profileDTO)
                .surveysCount(surveysCount)
                .responsesCount(responsesCount)
                .lastLogin(lastLogin)
                .recentAdminActivities(recentAdminActivities)
                .recentUserActivities(recentUserActivities)
                .build();
    }

    /**
     * Tạo user mới (chỉ admin)
     */
    @Transactional
    public UserResponseDTO createUser(UserRequestDTO requestDTO) throws IdInvalidException {
        validateAdminRole();
        
        // Kiểm tra email đã tồn tại chưa
        if (userRepository.existsByEmail(requestDTO.getEmail())) {
            throw new IdInvalidException("Email đã được sử dụng: " + requestDTO.getEmail());
        }
        
        // Validate role - không cho phép tạo user với role admin
        RoleEnum userRole = requestDTO.getRole() != null ? requestDTO.getRole() : RoleEnum.creator;
        if (userRole == RoleEnum.admin) {
            throw new IdInvalidException("Không được phép tạo user với role admin");
        }
        
        // Tạo user mới
        User user = new User();
        user.setFullName(requestDTO.getFullName().trim());
        user.setEmail(requestDTO.getEmail().trim().toLowerCase());
        user.setPasswordHash(passwordEncoder.encode(requestDTO.getPassword()));
        user.setRole(userRole);
        user.setIsActive(true);
        
        User savedUser = userRepository.save(user);
        
        // Log activity vào ActivityLog
        User currentAdmin = authService.getCurrentUser();
        activityLogService.log(
            ActivityLog.ActionType.admin_create_user,
            savedUser.getUserId(),
            "users",
            String.format("Admin %s đã tạo tài khoản mới: %s (%s) với role: %s", 
                currentAdmin.getFullName(), savedUser.getFullName(), savedUser.getEmail(), savedUser.getRole().name())
        );
        
        return UserResponseDTO.builder()
                .userId(savedUser.getUserId())
                .fullName(savedUser.getFullName())
                .email(savedUser.getEmail())
                .role(savedUser.getRole().name())
                .isActive(savedUser.getIsActive())
                .createdAt(savedUser.getCreatedAt())
                .updatedAt(savedUser.getUpdatedAt())
                .build();
    }

    /**
     * Cập nhật thông tin user (fullName, role)
     */
    @Transactional
    public UserResponseDTO updateUser(Long userId, String fullName, String role) throws IdInvalidException {
        validateAdminRole();
        
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy user"));
        
        User currentAdmin = authService.getCurrentUser();
        String oldRole = user.getRole().name();
        
        // Cập nhật fullName
        if (fullName != null && !fullName.trim().isEmpty()) {
            user.setFullName(fullName.trim());
        }
        
        // Cập nhật role
        if (role != null && !role.isEmpty()) {
            // Không cho phép thay đổi role của user đang là admin
            if (user.getRole() == RoleEnum.admin) {
                throw new IdInvalidException("Không được phép thay đổi role của tài khoản admin");
            }
            
            try {
                RoleEnum roleEnum = RoleEnum.valueOf(role.toLowerCase());
                
                // Không cho phép set role admin
                if (roleEnum == RoleEnum.admin) {
                    throw new IdInvalidException("Không được phép set role admin cho user");
                }
                
                user.setRole(roleEnum);
                
                // Log activity nếu role thay đổi
                if (!oldRole.equals(roleEnum.name())) {
                    activityLogService.log(
                        ActivityLog.ActionType.admin_update_user_role,
                        userId,
                        "users",
                        String.format("Admin %s đã đổi role của user %s (%s) từ %s sang %s", 
                            currentAdmin.getFullName(), user.getFullName(), user.getEmail(), oldRole, roleEnum.name())
                    );
                }
            } catch (IllegalArgumentException e) {
                throw new IdInvalidException("Role không hợp lệ: " + role);
            }
        }
        
        User saved = userRepository.save(user);
        
        return UserResponseDTO.builder()
                .userId(saved.getUserId())
                .fullName(saved.getFullName())
                .email(saved.getEmail())
                .role(saved.getRole().name())
                .isActive(saved.getIsActive())
                .createdAt(saved.getCreatedAt())
                .updatedAt(saved.getUpdatedAt())
                .build();
    }

    /**
     * Cập nhật trạng thái user (active/inactive)
     */
    @Transactional
    public UserResponseDTO updateUserStatus(Long userId, Boolean isActive) throws IdInvalidException {
        validateAdminRole();
        
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy user"));
        
        User currentAdmin = authService.getCurrentUser();
        
        user.setIsActive(isActive);
        User saved = userRepository.save(user);
        
        // Log activity vào ActivityLog
        if (isActive) {
            activityLogService.log(
                ActivityLog.ActionType.admin_activate_user,
                userId,
                "users",
                String.format("Admin %s đã kích hoạt tài khoản của user %s (%s)", 
                    currentAdmin.getFullName(), user.getFullName(), user.getEmail())
            );
        } else {
            activityLogService.log(
                ActivityLog.ActionType.admin_deactivate_user,
                userId,
                "users",
                String.format("Admin %s đã vô hiệu hóa tài khoản của user %s (%s)", 
                    currentAdmin.getFullName(), user.getFullName(), user.getEmail())
            );
        }
        
        return UserResponseDTO.builder()
                .userId(saved.getUserId())
                .fullName(saved.getFullName())
                .email(saved.getEmail())
                .role(saved.getRole().name())
                .isActive(saved.getIsActive())
                .createdAt(saved.getCreatedAt())
                .updatedAt(saved.getUpdatedAt())
                .build();
    }

    /**
     * Xóa user
     * Lưu ý: Phải xóa tất cả related data trước vì một số bảng không có ON DELETE CASCADE
     */
    @Transactional
    public void deleteUser(Long userId) throws IdInvalidException {
        validateAdminRole();
        
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy user"));
        
        // Không cho phép xóa admin
        if (user.getRole() == RoleEnum.admin) {
            throw new IdInvalidException("Không thể xóa tài khoản admin");
        }
        
        // Log activity TRƯỚC khi xóa user (vì sau khi xóa sẽ không thể log được)
        User currentAdmin = authService.getCurrentUser();
        String userInfo = String.format("%s (%s, role: %s)", user.getFullName(), user.getEmail(), user.getRole().name());
        activityLogService.log(
            ActivityLog.ActionType.admin_delete_user,
            userId,
            "users",
            String.format("Admin %s đã xóa tài khoản: %s", currentAdmin.getFullName(), userInfo)
        );
        
        // BƯỚC 1: Xóa tất cả surveys của user (và tất cả data liên quan)
        List<Survey> userSurveys = surveyRepository.findByUser(user);
        for (Survey survey : userSurveys) {
            // Xóa tất cả Answers trước
            List<Response> responses = responseRepository.findBySurvey(survey);
            for (Response response : responses) {
                List<Answer> answers = answerRepository.findByResponse(response);
                if (!answers.isEmpty()) {
                    answerRepository.deleteAll(answers);
                }
            }
            
            // Xóa tất cả Responses
            if (!responses.isEmpty()) {
                responseRepository.deleteAll(responses);
            }
            
            // Xóa tất cả Options và Questions
            List<Question> questions = questionRepository.findBySurvey(survey);
            for (Question question : questions) {
                List<Option> options = optionRepository.findByQuestion(question);
                if (!options.isEmpty()) {
                    optionRepository.deleteAll(options);
                }
            }
            if (!questions.isEmpty()) {
                questionRepository.deleteAll(questions);
            }
            
            // Xóa SurveyPermission, SurveyView, AI data
            List<SurveyPermission> permissions = surveyPermissionRepository.findBySurvey(survey);
            if (!permissions.isEmpty()) {
                surveyPermissionRepository.deleteAll(permissions);
            }
            
            List<SurveyView> views = surveyViewRepository.findBySurveyOrderByViewedAtDesc(survey);
            if (!views.isEmpty()) {
                surveyViewRepository.deleteAll(views);
            }
            
            List<AiSentiment> sentiments = aiSentimentRepository.findBySurvey(survey);
            if (!sentiments.isEmpty()) {
                aiSentimentRepository.deleteAll(sentiments);
            }
            
            List<AiAnalysis> analyses = aiAnalysisRepository.findBySurvey(survey);
            if (!analyses.isEmpty()) {
                aiAnalysisRepository.deleteAll(analyses);
            }
            
            List<AiChatLog> chatLogs = aiChatLogRepository.findBySurvey(survey);
            if (!chatLogs.isEmpty()) {
                aiChatLogRepository.deleteAll(chatLogs);
            }
        }
        // Xóa tất cả surveys của user
        if (!userSurveys.isEmpty()) {
            surveyRepository.deleteAll(userSurveys);
        }
        
        // BƯỚC 2: Xóa tất cả Responses của user (nếu có)
        List<Response> userResponses = responseRepository.findByUser(user);
        for (Response response : userResponses) {
            List<Answer> answers = answerRepository.findByResponse(response);
            if (!answers.isEmpty()) {
                answerRepository.deleteAll(answers);
            }
        }
        if (!userResponses.isEmpty()) {
            responseRepository.deleteAll(userResponses);
        }
        
        // BƯỚC 3: Xóa tất cả ActivityLogs của user
        List<ActivityLog> userActivityLogs = activityLogRepository.findByUser(user);
        if (!userActivityLogs.isEmpty()) {
            activityLogRepository.deleteAll(userActivityLogs);
        }
        
        // BƯỚC 4: Xóa tất cả AiChatLogs của user (cho surveys của user khác nếu có)
        List<AiChatLog> userChatLogs = aiChatLogRepository.findByUserId(userId);
        if (!userChatLogs.isEmpty()) {
            aiChatLogRepository.deleteAll(userChatLogs);
        }
        
        // BƯỚC 5: Cuối cùng xóa user
        // Các bảng có ON DELETE CASCADE sẽ tự động xóa:
        // - notifications, user_profiles, team_members, team_invitations, survey_permissions (user_id)
        userRepository.delete(user);
    }

    /**
     * Lấy danh sách surveys với phân trang và filter
     */
    public AdminSurveyPageDTO getSurveys(int page, int size, String search, String status, 
                                         Long userId, Long categoryId, 
                                         LocalDateTime dateFrom, LocalDateTime dateTo) throws IdInvalidException {
        validateAdminRole();
        
        Pageable pageable = PageRequest.of(page, size);
        SurveyStatusEnum statusEnum = null;
        if (status != null && !status.isEmpty()) {
            try {
                statusEnum = SurveyStatusEnum.valueOf(status.toLowerCase());
            } catch (IllegalArgumentException e) {
                // Invalid status, ignore
            }
        }
        
        Page<Survey> surveyPage = surveyRepository.findSurveysWithFilters(
            search, statusEnum, userId, categoryId, dateFrom, dateTo, pageable
        );
        
        List<AdminSurveyPageDTO.SurveyDTO> surveyDTOs = surveyPage.getContent().stream()
                .map(survey -> {
                    // Count responses
                    long responseCount = responseRepository.findBySurvey(survey).size();
                    // Count questions
                    long questionCount = questionRepository.countBySurvey(survey);
                    
                    return AdminSurveyPageDTO.SurveyDTO.builder()
                            .surveyId(survey.getSurveyId())
                            .title(survey.getTitle())
                            .description(survey.getDescription())
                            .status(survey.getStatus().name())
                            .userId(survey.getUser().getUserId())
                            .creatorName(survey.getUser().getFullName())
                            .creatorEmail(survey.getUser().getEmail())
                            .categoryId(survey.getCategory() != null ? survey.getCategory().getCategoryId() : null)
                            .categoryName(survey.getCategory() != null ? survey.getCategory().getCategoryName() : null)
                            .responseCount(responseCount)
                            .questionCount(questionCount)
                            .createdAt(survey.getCreatedAt())
                            .updatedAt(survey.getUpdatedAt())
                            .build();
                })
                .collect(Collectors.toList());
        
        return AdminSurveyPageDTO.builder()
                .surveys(surveyDTOs)
                .totalElements(surveyPage.getTotalElements())
                .totalPages(surveyPage.getTotalPages())
                .currentPage(page)
                .pageSize(size)
                .build();
    }

    /**
     * Lấy chi tiết survey
     */
    public AdminSurveyDetailDTO getSurveyDetail(Long surveyId) throws IdInvalidException {
        validateAdminRole();
        
        Survey survey = surveyRepository.findById(surveyId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy survey"));
        
        // Statistics
        long questionCount = questionRepository.countBySurvey(survey);
        long responseCount = responseRepository.findBySurvey(survey).size();
        long viewCount = surveyViewRepository.countBySurvey(survey);
        
        return AdminSurveyDetailDTO.builder()
                .surveyId(survey.getSurveyId())
                .title(survey.getTitle())
                .description(survey.getDescription())
                .status(survey.getStatus().name())
                .userId(survey.getUser().getUserId())
                .creatorName(survey.getUser().getFullName())
                .creatorEmail(survey.getUser().getEmail())
                .categoryId(survey.getCategory() != null ? survey.getCategory().getCategoryId() : null)
                .categoryName(survey.getCategory() != null ? survey.getCategory().getCategoryName() : null)
                .questionCount(questionCount)
                .responseCount(responseCount)
                .viewCount(viewCount)
                .createdAt(survey.getCreatedAt())
                .updatedAt(survey.getUpdatedAt())
                .build();
    }

    /**
     * Cập nhật trạng thái survey (chỉ cho phép published hoặc archived) - admin có quyền với mọi survey
     */
    @Transactional
    public AdminSurveyDetailDTO updateSurveyStatus(Long surveyId, String status) throws IdInvalidException {
        validateAdminRole();
        
        Survey survey = surveyRepository.findById(surveyId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy survey"));
        
        // Chỉ cho phép chuyển sang published hoặc archived
        SurveyStatusEnum newStatus;
        try {
            newStatus = SurveyStatusEnum.valueOf(status.toLowerCase());
            if (newStatus != SurveyStatusEnum.published && newStatus != SurveyStatusEnum.archived) {
                throw new IdInvalidException("Chỉ có thể chuyển survey sang trạng thái published hoặc archived");
            }
        } catch (IllegalArgumentException e) {
            throw new IdInvalidException("Trạng thái không hợp lệ: " + status);
        }
        
        // Chuyển trạng thái
        survey.setStatus(newStatus);
        Survey savedSurvey = surveyRepository.save(survey);
        
        // Log activity
        User currentAdmin = authService.getCurrentUser();
        activityLogService.log(
            ActivityLog.ActionType.edit_survey,
            surveyId,
            "surveys",
            String.format("Admin %s đã chuyển khảo sát '%s' sang trạng thái: %s", 
                currentAdmin.getFullName(), savedSurvey.getTitle(), newStatus.name())
        );
        
        // Trả về survey detail
        long questionCount = questionRepository.countBySurvey(savedSurvey);
        long responseCount = responseRepository.findBySurvey(savedSurvey).size();
        long viewCount = surveyViewRepository.countBySurvey(savedSurvey);
        
        return AdminSurveyDetailDTO.builder()
                .surveyId(savedSurvey.getSurveyId())
                .title(savedSurvey.getTitle())
                .description(savedSurvey.getDescription())
                .status(savedSurvey.getStatus().name())
                .userId(savedSurvey.getUser().getUserId())
                .creatorName(savedSurvey.getUser().getFullName())
                .creatorEmail(savedSurvey.getUser().getEmail())
                .categoryId(savedSurvey.getCategory() != null ? savedSurvey.getCategory().getCategoryId() : null)
                .categoryName(savedSurvey.getCategory() != null ? savedSurvey.getCategory().getCategoryName() : null)
                .questionCount(questionCount)
                .responseCount(responseCount)
                .viewCount(viewCount)
                .createdAt(savedSurvey.getCreatedAt())
                .updatedAt(savedSurvey.getUpdatedAt())
                .build();
    }

    /**
     * Xóa survey (admin có quyền xóa bất kỳ survey nào)
     */
    @Transactional
    public void deleteSurvey(Long surveyId) throws IdInvalidException {
        validateAdminRole();
        
        Survey survey = surveyRepository.findById(surveyId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy survey"));
        
        User currentAdmin = authService.getCurrentUser();
        String surveyTitle = survey.getTitle(); // Lưu title trước khi xóa để dùng trong log
        
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
            }
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
        
        // Log activity (sử dụng title đã lưu)
        activityLogService.log(
            ActivityLog.ActionType.delete_survey,
            surveyId,
            "surveys",
            String.format("Admin %s đã xóa khảo sát: %s", currentAdmin.getFullName(), surveyTitle)
        );
    }

    /**
     * Lấy danh sách admin notifications (audit logs)
     */
    public AdminNotificationPageDTO getAdminNotifications(int page, int size, Long userId, 
                                                          String type, Boolean isRead,
                                                          LocalDateTime dateFrom, LocalDateTime dateTo) throws IdInvalidException {
        validateAdminRole();
        
        Pageable pageable = PageRequest.of(page, size);
        
        // Parse type enum
        Notification.NotificationType typeEnum = null;
        if (type != null && !type.isEmpty()) {
            try {
                typeEnum = Notification.NotificationType.valueOf(type);
            } catch (IllegalArgumentException e) {
                // Invalid type, will return empty result
                typeEnum = null;
            }
        }
        
        // Query với tất cả filters
        Page<Notification> notificationPage = notificationRepository.findAdminNotificationsWithFilters(
            userId, typeEnum, isRead, dateFrom, dateTo, pageable
        );
        
        List<AdminNotificationPageDTO.NotificationDTO> notificationDTOs = notificationPage.getContent().stream()
                .map(notif -> AdminNotificationPageDTO.NotificationDTO.builder()
                        .notificationId(notif.getNotificationId())
                        .userId(notif.getUser().getUserId())
                        .userName(notif.getUser().getFullName())
                        .userEmail(notif.getUser().getEmail())
                        .type(notif.getType().name())
                        .title(notif.getTitle())
                        .message(notif.getMessage())
                        .relatedEntityType(notif.getRelatedEntityType())
                        .relatedEntityId(notif.getRelatedEntityId())
                        .isRead(notif.getIsRead())
                        .createdAt(notif.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
        
        return AdminNotificationPageDTO.builder()
                .notifications(notificationDTOs)
                .totalElements(notificationPage.getTotalElements())
                .totalPages(notificationPage.getTotalPages())
                .currentPage(page)
                .pageSize(size)
                .build();
    }

    /**
     * Lấy danh sách activity logs với phân trang và filter (cho Survey history)
     */
    public AdminActivityLogPageDTO getActivityLogs(int page, int size, Long userId,
                                                   String actionType,
                                                   LocalDateTime dateFrom, LocalDateTime dateTo) throws IdInvalidException {
        validateAdminRole();
        
        Pageable pageable = PageRequest.of(page, size);
        ActivityLog.ActionType actionTypeEnum = null;
        if (actionType != null && !actionType.isEmpty()) {
            try {
                actionTypeEnum = ActivityLog.ActionType.valueOf(actionType);
            } catch (IllegalArgumentException e) {
                // Invalid action type, ignore
            }
        }
        
        Page<ActivityLog> activityLogPage = activityLogRepository.findActivityLogsWithFilters(
            userId, actionTypeEnum, dateFrom, dateTo, pageable
        );
        
        List<AdminActivityLogPageDTO.ActivityLogDTO> activityLogDTOs = activityLogPage.getContent().stream()
                .map(log -> AdminActivityLogPageDTO.ActivityLogDTO.builder()
                        .logId(log.getLogId())
                        .userId(log.getUser() != null ? log.getUser().getUserId() : null)
                        .userName(log.getUser() != null ? log.getUser().getFullName() : "System")
                        .userEmail(log.getUser() != null ? log.getUser().getEmail() : null)
                        .actionType(log.getActionType().name())
                        .description(log.getDescription())
                        .targetId(log.getTargetId())
                        .targetTable(log.getTargetTable())
                        .createdAt(log.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
        
        return AdminActivityLogPageDTO.builder()
                .activityLogs(activityLogDTOs)
                .totalElements(activityLogPage.getTotalElements())
                .totalPages(activityLogPage.getTotalPages())
                .currentPage(page)
                .pageSize(size)
                .build();
    }
}



