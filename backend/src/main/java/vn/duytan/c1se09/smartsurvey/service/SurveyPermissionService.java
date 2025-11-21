package vn.duytan.c1se09.smartsurvey.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.duytan.c1se09.smartsurvey.domain.Survey;
import vn.duytan.c1se09.smartsurvey.domain.SurveyPermission;
import vn.duytan.c1se09.smartsurvey.domain.User;
import vn.duytan.c1se09.smartsurvey.domain.Team;
import vn.duytan.c1se09.smartsurvey.domain.request.survey.SurveyPermissionUpdateRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.survey.SurveyPermissionResponseDTO;
import vn.duytan.c1se09.smartsurvey.repository.SurveyPermissionRepository;
import vn.duytan.c1se09.smartsurvey.repository.TeamMemberRepository;
import vn.duytan.c1se09.smartsurvey.repository.TeamRepository;
import vn.duytan.c1se09.smartsurvey.repository.UserRepository;
import vn.duytan.c1se09.smartsurvey.domain.Notification;
import vn.duytan.c1se09.smartsurvey.util.constant.SurveyPermissionRole;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Service để kiểm tra và quản lý permissions cho surveys
 * Centralized permission checking - giống Typeform/Google Forms
 */
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class SurveyPermissionService {

    private final SurveyPermissionRepository surveyPermissionRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final TeamRepository teamRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    /**
     * Lấy permission của user cho survey này
     * Logic:
     * 1. Nếu user là owner của survey (survey.user_id = user.user_id) → return OWNER
     *    - Điều này đảm bảo user với role "owner" trong DB (hoặc bất kỳ role nào) 
     *      nếu là người tạo survey sẽ luôn có quyền OWNER trên survey đó
     * 2. Nếu có permission trực tiếp (user_id) → return permission đó
     *    - Nếu có restrictedTeamId: kiểm tra user còn trong team không
     *    - Nếu không có restrictedTeamId: permission độc lập (giống Google Form)
     * 3. Nếu không có → return null (không có quyền)
     * 
     * Lưu ý: 
     * - Đã xóa team permission, chỉ còn user permission
     * - User tạo survey (survey.user) luôn có quyền OWNER, không phụ thuộc vào role hệ thống
     */
    public SurveyPermissionRole getUserPermission(Survey survey, User user) {
        // Check owner first - User tạo survey luôn có quyền OWNER
        // Điều này đảm bảo user với role "owner" trong DB (hoặc bất kỳ role nào)
        // nếu là người tạo survey sẽ luôn có quyền SurveyPermissionRole.OWNER
        // QUAN TRỌNG: Quyền OWNER trên survey KHÔNG phụ thuộc vào role hệ thống (RoleEnum)
        // Chỉ cần survey.user_id = user.user_id → luôn có quyền OWNER
        if (survey != null && survey.getUser() != null && survey.getUser().getUserId() != null 
                && user != null && user.getUserId() != null
                && survey.getUser().getUserId().equals(user.getUserId())) {
            // User là người tạo survey → luôn có quyền OWNER
            // Điều này đúng cho mọi role: admin, creator, respondent, owner (trong DB)
            return SurveyPermissionRole.OWNER;
        }

        // Check direct user permission only (không còn team permission)
        Optional<SurveyPermission> directPerm = surveyPermissionRepository.findBySurveyAndUser(survey, user);
        if (directPerm.isPresent()) {
            SurveyPermission permission = directPerm.get();
            if (permission.getRestrictedTeam() != null) {
                Team restrictedTeam = permission.getRestrictedTeam();
                if (!isUserStillInTeam(user, restrictedTeam)) {
                    // User đã rời khỏi team bị ràng buộc -> bỏ qua quyền này
                    return null;
                } else {
                    return permission.getPermission();
                }
            } else {
                // Permission độc lập (không ràng buộc team) - giống Google Form
                return permission.getPermission();
            }
        }

        // Không có permission nào
        return null;
    }

    private boolean isUserStillInTeam(User user, Team team) {
        if (team == null) {
            return true;
        }
        if (team.getOwner() != null && team.getOwner().getUserId().equals(user.getUserId())) {
            return true;
        }
        return teamMemberRepository.existsByTeamAndUser(team, user);
    }


    /**
     * Check if user can edit survey
     */
    public boolean canEdit(Survey survey, User user) {
        SurveyPermissionRole perm = getUserPermission(survey, user);
        return perm != null && perm.canEditSurvey();
    }

    /**
     * Check if user can view results
     */
    public boolean canViewResults(Survey survey, User user) {
        SurveyPermissionRole perm = getUserPermission(survey, user);
        return perm != null && perm.canViewResults();
    }

    /**
     * Check if user can view survey
     */
    public boolean canViewSurvey(Survey survey, User user) {
        SurveyPermissionRole perm = getUserPermission(survey, user);
        return perm != null && perm.canViewSurvey();
    }

    /**
     * Check if user can delete survey
     */
    public boolean canDelete(Survey survey, User user) {
        SurveyPermissionRole perm = getUserPermission(survey, user);
        return perm != null && perm.canDeleteSurvey();
    }

    /**
     * Check if user can manage permissions (share survey)
     */
    public boolean canManagePermissions(Survey survey, User user) {
        SurveyPermissionRole perm = getUserPermission(survey, user);
        return perm != null && perm.canManagePermissions();
    }

    /**
     * Update permissions for survey (create/update/delete)
     * Chỉ OWNER mới có quyền gọi method này
     */
    @Transactional
    public SurveyPermissionResponseDTO updatePermissions(
            Survey survey,
            SurveyPermissionUpdateRequestDTO request,
            User grantedBy) throws IdInvalidException {
        
        // Validate user có quyền manage permissions
        if (!canManagePermissions(survey, grantedBy)) {
            throw new IdInvalidException("Bạn không có quyền quản lý permissions của survey này");
        }

        List<String> warnings = new ArrayList<>();
        List<SurveyPermissionResponseDTO.SharedUserDTO> sharedUsers = new ArrayList<>();

        if (request.getTeamAccess() == null || request.getTeamAccess().isEmpty()) {
            // Nếu không có permissions nào trong request, xóa tất cả permissions
            List<SurveyPermission> existingPermissions = surveyPermissionRepository.findBySurvey(survey);
            surveyPermissionRepository.deleteAll(existingPermissions);
        } else {
            // Lấy danh sách userId từ request
            Set<Long> requestedUserIds = request.getTeamAccess().stream()
                    .map(access -> {
                        if (access.getUserId() != null) {
                            return access.getUserId();
                        } else if (access.getEmail() != null) {
                            return userRepository.findByEmail(access.getEmail())
                                    .map(User::getUserId)
                                    .orElse(null);
                        }
                        return null;
                    })
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());

            // Xóa các permissions không còn trong request
            List<SurveyPermission> existingPermissions = surveyPermissionRepository.findBySurvey(survey);
            for (SurveyPermission perm : existingPermissions) {
                if (!requestedUserIds.contains(perm.getUser().getUserId())) {
                    // Lưu thông tin trước khi xóa để gửi notification
                    User targetUser = perm.getUser();
                    SurveyPermissionRole oldPermission = perm.getPermission();
                    Team oldRestrictedTeam = perm.getRestrictedTeam();
                    
                    // Xóa permission
                    surveyPermissionRepository.delete(perm);
                    
                    // Gửi notification cho user bị xóa quyền
                    if (targetUser != null) {
                        try {
                            String permissionName = getPermissionDisplayName(oldPermission);
                            String teamInfo = oldRestrictedTeam != null 
                                ? " (team " + oldRestrictedTeam.getName() + ")" : "";
                            
                            notificationService.createNotification(
                                targetUser,
                                Notification.NotificationType.SURVEY_PERMISSION_CHANGED,
                                "Quyền truy cập survey đã bị thu hồi",
                                String.format(
                                    "%s đã thu hồi quyền %s của bạn trên survey '%s'%s",
                                    grantedBy.getFullName() != null ? grantedBy.getFullName() : grantedBy.getEmail(),
                                    permissionName,
                                    survey.getTitle(),
                                    teamInfo
                                ),
                                "survey",
                                survey.getSurveyId()
                            );
                        } catch (Exception e) {
                            // Log lỗi nhưng không throw để không ảnh hưởng đến việc xóa permission
                            System.err.println("Lỗi khi gửi notification khi xóa permission: " + e.getMessage());
                            e.printStackTrace();
                        }
                    }
                }
            }

            // Xử lý từng permission trong request
            for (SurveyPermissionUpdateRequestDTO.TeamAccessDTO access : request.getTeamAccess()) {
                User targetUser = null;
                
                // Tìm user theo userId hoặc email
                if (access.getUserId() != null) {
                    targetUser = userRepository.findById(access.getUserId())
                            .orElseThrow(() -> new IdInvalidException("Không tìm thấy user với ID: " + access.getUserId()));
                } else if (access.getEmail() != null) {
                    targetUser = userRepository.findByEmail(access.getEmail())
                            .orElseThrow(() -> new IdInvalidException("Không tìm thấy user với email: " + access.getEmail()));
                } else {
                    warnings.add("Bỏ qua permission không có userId hoặc email");
                    continue;
                }

                // Không thể share cho chính owner
                if (targetUser.getUserId().equals(survey.getUser().getUserId())) {
                    warnings.add("Không thể share permission cho chính owner của survey");
                    continue;
                }

                // Validate team nếu có restrictedTeamId
                Team restrictedTeam = null;
                if (access.getRestrictedTeamId() != null) {
                    restrictedTeam = teamRepository.findById(access.getRestrictedTeamId())
                            .orElseThrow(() -> new IdInvalidException("Không tìm thấy team với ID: " + access.getRestrictedTeamId()));
                    
                    // Validate user phải là member của team
                    if (!isUserStillInTeam(targetUser, restrictedTeam)) {
                        warnings.add("User " + targetUser.getEmail() + " không phải là member của team " + restrictedTeam.getName());
                        continue;
                    }
                }

                // Tìm permission hiện tại
                Optional<SurveyPermission> existingPerm = surveyPermissionRepository.findBySurveyAndUser(survey, targetUser);

                SurveyPermission permission;
                boolean isNewPermission = false;
                SurveyPermissionRole oldPermission = null;
                boolean permissionChanged = false;
                boolean teamChanged = false;
                Team oldRestrictedTeam = null;
                
                if (existingPerm.isPresent()) {
                    // Update existing permission
                    permission = existingPerm.get();
                    oldPermission = permission.getPermission();
                    oldRestrictedTeam = permission.getRestrictedTeam();
                    permissionChanged = !oldPermission.equals(access.getPermission());
                    
                    // Validate transition: không thể chuyển từ độc lập → team-restricted hoặc ngược lại
                    // Kiểm tra team có thay đổi không
                    Long oldTeamId = oldRestrictedTeam != null ? oldRestrictedTeam.getTeamId() : null;
                    Long newTeamId = restrictedTeam != null ? restrictedTeam.getTeamId() : null;
                    teamChanged = !java.util.Objects.equals(oldTeamId, newTeamId);
                    
                    if (permission.getRestrictedTeam() == null && restrictedTeam != null) {
                        throw new IdInvalidException("Không thể chuyển từ permission độc lập sang team-restricted cho user: " + targetUser.getEmail());
                    }
                    if (permission.getRestrictedTeam() != null && restrictedTeam == null) {
                        throw new IdInvalidException("Không thể chuyển từ team-restricted sang permission độc lập cho user: " + targetUser.getEmail());
                    }
                    if (teamChanged && oldRestrictedTeam != null && restrictedTeam != null) {
                        warnings.add("Đang chuyển user " + targetUser.getEmail() + " từ team " + oldRestrictedTeam.getName() + " sang team " + restrictedTeam.getName());
                    }
                    
                    permission.setPermission(access.getPermission());
                    permission.setRestrictedTeam(restrictedTeam);
                    permission.setGrantedBy(grantedBy);
                } else {
                    // Create new permission
                    isNewPermission = true;
                    permission = new SurveyPermission();
                    permission.setSurvey(survey);
                    permission.setUser(targetUser);
                    permission.setPermission(access.getPermission());
                    permission.setRestrictedTeam(restrictedTeam);
                    permission.setGrantedBy(grantedBy);
                }

                surveyPermissionRepository.save(permission);

                // Gửi thông báo cho user
                try {
                    String notificationTitle=null ;
                    String notificationMessage =null;
                    Notification.NotificationType notificationType = null;
                    
                    if (isNewPermission) {
                        // Permission mới - gửi SURVEY_SHARED
                        notificationType = Notification.NotificationType.SURVEY_SHARED;
                        
                        if (restrictedTeam != null) {
                            // Team-restricted permission
                            notificationTitle = "Survey được chia sẻ với bạn (Team: " + restrictedTeam.getName() + ")";
                            notificationMessage = String.format(
                                "%s đã chia sẻ survey \"%s\" với bạn với quyền %s trong team %s. " +
                                "Bạn chỉ có quyền này khi còn là member của team.",
                                grantedBy.getFullName() != null ? grantedBy.getFullName() : grantedBy.getEmail(),
                                survey.getTitle(),
                                getPermissionDisplayName(permission.getPermission()),
                                restrictedTeam.getName()
                            );
                        } else {
                            // Độc lập permission
                            notificationTitle = "Survey được chia sẻ với bạn";
                            notificationMessage = String.format(
                                "%s đã chia sẻ survey \"%s\" với bạn với quyền %s.",
                                grantedBy.getFullName() != null ? grantedBy.getFullName() : grantedBy.getEmail(),
                                survey.getTitle(),
                                getPermissionDisplayName(permission.getPermission())
                            );
                        }
                    } else if (permissionChanged || teamChanged) {
                        // Permission đã thay đổi - gửi SURVEY_PERMISSION_CHANGED
                        notificationType = Notification.NotificationType.SURVEY_PERMISSION_CHANGED;
                        notificationTitle = "Quyền truy cập survey đã thay đổi";
                        
                        if (permissionChanged && teamChanged) {
                            // Cả permission và team đều thay đổi
                            String oldTeamName = oldRestrictedTeam != null ? oldRestrictedTeam.getName() : null;
                            String newTeamName = restrictedTeam != null ? restrictedTeam.getName() : null;
                            String oldTeamInfo = oldTeamName != null ? " (team " + oldTeamName + ")" : "";
                            String newTeamInfo = newTeamName != null ? " (team " + newTeamName + ")" : "";
                            notificationMessage = String.format(
                                "Quyền của bạn trên survey '%s' đã được %s thay đổi từ %s%s sang %s%s",
                                survey.getTitle(),
                                grantedBy.getFullName() != null ? grantedBy.getFullName() : grantedBy.getEmail(),
                                getPermissionDisplayName(oldPermission),
                                oldTeamInfo,
                                getPermissionDisplayName(access.getPermission()),
                                newTeamInfo
                            );
                        } else if (permissionChanged) {
                            // Chỉ permission thay đổi
                            notificationMessage = String.format(
                                "Quyền của bạn trên survey '%s' đã được %s thay đổi từ %s sang %s",
                                survey.getTitle(),
                                grantedBy.getFullName() != null ? grantedBy.getFullName() : grantedBy.getEmail(),
                                getPermissionDisplayName(oldPermission),
                                getPermissionDisplayName(access.getPermission())
                            );
                        } else {
                            // Chỉ team thay đổi
                            String oldTeamName = oldRestrictedTeam != null ? oldRestrictedTeam.getName() : null;
                            String newTeamName = restrictedTeam != null ? restrictedTeam.getName() : null;
                            String oldTeamInfo = oldTeamName != null ? "team " + oldTeamName : "không giới hạn";
                            String newTeamInfo = newTeamName != null ? "team " + newTeamName : "không giới hạn";
                            notificationMessage = String.format(
                                "Phạm vi quyền %s của bạn trên survey '%s' đã được %s thay đổi từ %s sang %s",
                                getPermissionDisplayName(access.getPermission()),
                                survey.getTitle(),
                                grantedBy.getFullName() != null ? grantedBy.getFullName() : grantedBy.getEmail(),
                                oldTeamInfo,
                                newTeamInfo
                            );
                        }
                    } else {
                        // Permission không thay đổi - không gửi notification
                        notificationType = null;
                    }
                    
                    // Chỉ gửi notification nếu có thay đổi
                    if (notificationType != null) {
                        notificationService.createNotification(
                            targetUser,
                            notificationType,
                            notificationTitle,
                            notificationMessage,
                            "survey",
                            survey.getSurveyId()
                        );
                    }
                } catch (Exception e) {
                    // Log lỗi nhưng không throw để không ảnh hưởng đến việc cập nhật permission
                    System.err.println("Lỗi khi gửi notification khi cập nhật permission: " + e.getMessage());
                    e.printStackTrace();
                }

                // Build response DTO
                SurveyPermissionResponseDTO.SharedUserDTO sharedUser = SurveyPermissionResponseDTO.SharedUserDTO.builder()
                        .userId(targetUser.getUserId())
                        .email(targetUser.getEmail())
                        .fullName(targetUser.getFullName())
                        .permission(permission.getPermission())
                        .grantedBy(grantedBy.getUserId())
                        .grantedByName(grantedBy.getFullName())
                        .updatedAt(permission.getUpdatedAt())
                        .restrictedTeamId(restrictedTeam != null ? restrictedTeam.getTeamId() : null)
                        .restrictedTeamName(restrictedTeam != null ? restrictedTeam.getName() : null)
                        .build();

                sharedUsers.add(sharedUser);
            }
        }

        // Build response
        return SurveyPermissionResponseDTO.builder()
                .surveyId(survey.getSurveyId())
                .users(sharedUsers)
                .warnings(warnings)
                .build();
    }

    /**
     * Get all permissions for a survey
     */
    public SurveyPermissionResponseDTO getSurveyPermissions(Survey survey) {
        List<SurveyPermission> permissions = surveyPermissionRepository.findBySurvey(survey);
        
        List<SurveyPermissionResponseDTO.SharedUserDTO> sharedUsers = permissions.stream()
                .map(perm -> {
                    User user = perm.getUser();
                    User grantedByUser = perm.getGrantedBy();
                    Team restrictedTeam = perm.getRestrictedTeam();

                    return SurveyPermissionResponseDTO.SharedUserDTO.builder()
                            .userId(user.getUserId())
                            .email(user.getEmail())
                            .fullName(user.getFullName())
                            .permission(perm.getPermission())
                            .grantedBy(grantedByUser != null ? grantedByUser.getUserId() : null)
                            .grantedByName(grantedByUser != null ? grantedByUser.getFullName() : null)
                            .updatedAt(perm.getUpdatedAt())
                            .restrictedTeamId(restrictedTeam != null ? restrictedTeam.getTeamId() : null)
                            .restrictedTeamName(restrictedTeam != null ? restrictedTeam.getName() : null)
                            .build();
                })
                .collect(Collectors.toList());

        return SurveyPermissionResponseDTO.builder()
                .surveyId(survey.getSurveyId())
                .users(sharedUsers)
                .warnings(Collections.emptyList())
                .build();
    }

    /**
     * Delete a specific permission
     */
    @Transactional
    public void deletePermission(Long permissionId, User currentUser) throws IdInvalidException {
        SurveyPermission permission = surveyPermissionRepository.findById(permissionId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy permission với ID: " + permissionId));

        // Check user có quyền manage permissions
        if (!canManagePermissions(permission.getSurvey(), currentUser)) {
            throw new IdInvalidException("Bạn không có quyền xóa permission này");
        }

        // Lưu thông tin trước khi xóa để gửi notification
        User targetUser = permission.getUser();
        Survey survey = permission.getSurvey();
        
        // Xóa permission
        surveyPermissionRepository.delete(permission);
        
        // Gửi notification cho user bị xóa quyền
        if (targetUser != null) {
            try {
                String permissionName = getPermissionDisplayName(permission.getPermission());
                String teamInfo = permission.getRestrictedTeam() != null 
                    ? " (team " + permission.getRestrictedTeam().getName() + ")" : "";
                
                notificationService.createNotification(
                    targetUser,
                    Notification.NotificationType.SURVEY_PERMISSION_CHANGED,
                    "Quyền truy cập survey đã bị thu hồi",
                    String.format(
                        "%s đã thu hồi quyền %s của bạn trên survey '%s'%s",
                        currentUser.getFullName() != null ? currentUser.getFullName() : currentUser.getEmail(),
                        permissionName,
                        survey.getTitle(),
                        teamInfo
                    ),
                    "survey",
                    survey.getSurveyId()
                );
            } catch (Exception e) {
                // Log lỗi nhưng không throw để không ảnh hưởng đến việc xóa permission
                System.err.println("Lỗi khi gửi notification khi xóa permission: " + e.getMessage());
                e.printStackTrace();
            }
        }
    }

    /**
     * Lấy tên hiển thị của permission role (tiếng Việt)
     */
    private String getPermissionDisplayName(SurveyPermissionRole role) {
        return switch (role) {
            case OWNER -> "Chủ sở hữu";
            case EDITOR -> "Biên tập viên";
            case ANALYST -> "Phân tích viên";
            case VIEWER -> "Người xem";
        };
    }
}
















