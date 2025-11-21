package vn.duytan.c1se09.smartsurvey.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vn.duytan.c1se09.smartsurvey.domain.User;
import vn.duytan.c1se09.smartsurvey.domain.Survey;
import vn.duytan.c1se09.smartsurvey.domain.ActivityLog;
import vn.duytan.c1se09.smartsurvey.domain.response.dashboard.UserDashboardResponseDTO;
import vn.duytan.c1se09.smartsurvey.repository.*;
import vn.duytan.c1se09.smartsurvey.util.constant.SurveyStatusEnum;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;
import vn.duytan.c1se09.smartsurvey.util.constant.SurveyPermissionRole;

import java.util.List;

/**
 * Service để tính toán dashboard overview cho user
 */
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class DashboardService {

    private final SurveyRepository surveyRepository;
    private final ResponseRepository responseRepository;
    private final TeamRepository teamRepository;
    private final SurveyPermissionRepository surveyPermissionRepository;
    private final ActivityLogRepository activityLogRepository;
    private final AuthService authService;
    private final SurveyPermissionService surveyPermissionService;

    /**
     * Lấy tổng quan dashboard cho user hiện tại
     * Bao gồm: owned surveys, shared surveys, teams, total responses
     */
    public UserDashboardResponseDTO getUserDashboard() throws IdInvalidException {
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new IdInvalidException("Người dùng chưa xác thực");
        }

        // 1. Đếm surveys mà user sở hữu
        long ownedSurveys = surveyRepository.countByUser(currentUser);

        // 2. Lấy danh sách surveys mà user có quyền truy cập (owned + shared)
        var accessiblePage = surveyRepository
                .findAccessibleSurveysByUser(currentUser, org.springframework.data.domain.Pageable.unpaged());
        List<Survey> accessibleSurveys = accessiblePage.getContent();
        List<Long> accessibleSurveyIds = accessibleSurveys.stream()
                .map(Survey::getSurveyId)
                .toList();

        // 3. Đếm active surveys (published) mà user có quyền truy cập
        long activeSurveys = accessibleSurveys.stream()
                .filter(s -> s.getStatus() == SurveyStatusEnum.published)
                .count();

        // 3b. Chi tiết survey được share (chỉ hiển thị survey có permission, không null)
        List<UserDashboardResponseDTO.SharedSurveyDTO> sharedDetails = accessibleSurveys.stream()
                .filter(s -> !s.getUser().getUserId().equals(currentUser.getUserId()))
                .map(s -> {
                    SurveyPermissionRole permission = surveyPermissionService.getUserPermission(s, currentUser);
                    boolean sharedDirect = surveyPermissionRepository.findBySurveyAndUser(s, currentUser).isPresent();
                    String sharedVia = sharedDirect ? "user" : "team";
                    return UserDashboardResponseDTO.SharedSurveyDTO.builder()
                            .surveyId(s.getSurveyId())
                            .title(s.getTitle())
                            .permission(permission != null ? permission.name() : null)
                            .sharedVia(sharedVia)
                            .build();
                })
                .filter(detail -> detail.getPermission() != null) // Chỉ giữ lại survey có permission (không null)
                .toList();

        // Đếm số shared surveys (chỉ tính những survey có permission, không null)
        long sharedSurveys = sharedDetails.size();

        // 4. Đếm tổng số responses của tất cả surveys mà user có quyền xem
        long totalResponses = accessibleSurveyIds.stream()
                .mapToLong(surveyId -> {
                    try {
                        var survey = surveyRepository.findById(surveyId);
                        return survey.map(s -> (long) responseRepository.findBySurvey(s).size()).orElse(0L);
                    } catch (Exception e) {
                        return 0L;
                    }
                })
                .sum();

        // 5. Đếm teams mà user là owner hoặc member
        long totalTeams = teamRepository.findTeamsByOwnerOrMember(currentUser, currentUser).size();

        // 6. Lấy recent activity (10 hoạt động gần nhất)
        // Xử lý exception khi load activities (có thể có action_type không hợp lệ trong DB)
        System.out.println("Getting recent activities...");
        List<UserDashboardResponseDTO.ActivityDTO> activityDTOs = new java.util.ArrayList<>();
        try {
            List<ActivityLog> recentActivities = activityLogRepository
                    .findByUserOrderByCreatedAtDesc(currentUser)
                    .stream()
                    .limit(10)
                    .toList();
            
            activityDTOs = recentActivities.stream()
                    .filter(activity -> activity != null && activity.getActionType() != null)
                    .map(activity -> {
                        try {
                            return UserDashboardResponseDTO.ActivityDTO.builder()
                                    .actionType(activity.getActionType().name())
                                    .description(activity.getDescription())
                                    .targetId(activity.getTargetId())
                                    .targetTable(activity.getTargetTable())
                                    .createdAt(activity.getCreatedAt())
                                    .build();
                        } catch (Exception e) {
                            System.out.println("ERROR mapping activity: " + e.getMessage());
                            return null;
                        }
                    })
                    .filter(dto -> dto != null)
                    .toList();
        } catch (Exception e) {
            System.out.println("ERROR loading activities: " + e.getMessage());
            System.out.println("Exception type: " + e.getClass().getName());
            // Nếu có lỗi khi load activities, trả về danh sách rỗng thay vì fail toàn bộ request
            activityDTOs = new java.util.ArrayList<>();
        }
        System.out.println("Recent activities count: " + activityDTOs.size());

        System.out.println("Building response DTO...");
        return UserDashboardResponseDTO.builder()
                .ownedSurveys(ownedSurveys)
                .sharedSurveys(sharedSurveys)
                .totalSurveys(ownedSurveys + sharedSurveys)
                .activeSurveys(activeSurveys)
                .totalResponses(totalResponses)
                .totalTeams(totalTeams)
                .sharedSurveysDetail(sharedDetails)
                .recentActivity(activityDTOs)
                .build();
    }
}

