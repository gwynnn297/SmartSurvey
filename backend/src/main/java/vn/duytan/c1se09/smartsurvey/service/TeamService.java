package vn.duytan.c1se09.smartsurvey.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.duytan.c1se09.smartsurvey.domain.*;
import vn.duytan.c1se09.smartsurvey.domain.request.team.TeamCreateRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.team.TeamInvitationRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.team.*;
import vn.duytan.c1se09.smartsurvey.repository.*;
import vn.duytan.c1se09.smartsurvey.util.constant.SurveyPermissionRole;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;

import java.security.SecureRandom;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service xử lý toàn bộ business logic liên quan đến Team
 */
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class TeamService {

    private static final int INVITE_CODE_LENGTH = 8;
    private static final int INVITATION_EXPIRY_DAYS = 7;
    private static final String RELATED_ENTITY_TEAM = "team";

    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final TeamInvitationRepository teamInvitationRepository;
    private final SurveyPermissionRepository surveyPermissionRepository;
    private final UserRepository userRepository;
    private final AuthService authService;
    private final NotificationService notificationService;

    /**
     * Tạo team mới và gắn current user làm OWNER
     */
    @Transactional
    public TeamResponseDTO createTeam(TeamCreateRequestDTO request) throws IdInvalidException {
        User currentUser = getCurrentUserOrThrow();

        Team team = new Team();
        team.setName(request.getName().trim());
        team.setDescription(request.getDescription());
        team.setOwner(currentUser);
        team.setInviteCode(generateUniqueInviteCode());

        Team saved = teamRepository.save(team);

        TeamMember ownerMember = new TeamMember();
        ownerMember.setTeam(saved);
        ownerMember.setUser(currentUser);
        ownerMember.setRole(SurveyPermissionRole.OWNER);
        teamMemberRepository.save(ownerMember);

        notificationService.createNotification(
                currentUser,
                Notification.NotificationType.TEAM_CREATED,
                "Tạo team mới thành công",
                "Bạn đã tạo team " + saved.getName(),
                RELATED_ENTITY_TEAM,
                saved.getTeamId());

        return toTeamResponseDTO(saved);
    }

    /**
     * Cập nhật thông tin team (chỉ OWNER)
     */
    @Transactional
    public TeamResponseDTO updateTeam(Long teamId, TeamCreateRequestDTO request) throws IdInvalidException {
        User currentUser = getCurrentUserOrThrow();
        Team team = getTeamOrThrow(teamId);
        ensureOwner(team, currentUser);

        team.setName(request.getName().trim());
        team.setDescription(request.getDescription());

        return toTeamResponseDTO(teamRepository.save(team));
    }

    /**
     * Gửi invitation cho user theo email (thay vì thêm thẳng vào team)
     */
    @Transactional
    public TeamInvitationResponseDTO sendInvitation(Long teamId, TeamInvitationRequestDTO request)
            throws IdInvalidException {
        User currentUser = getCurrentUserOrThrow();
        Team team = getTeamOrThrow(teamId);
        ensureOwner(team, currentUser);

        User target = userRepository.findByEmail(request.getEmail().trim().toLowerCase())
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy user với email này"));

        if (target.getUserId().equals(currentUser.getUserId())) {
            throw new IdInvalidException("Bạn không thể tự mời chính mình");
        }
        if (teamMemberRepository.existsByTeamAndUser(team, target)) {
            throw new IdInvalidException("User đã là thành viên của team");
        }
        if (teamInvitationRepository.existsByTeamAndUserAndStatus(team, target, TeamInvitation.InvitationStatus.PENDING)) {
            throw new IdInvalidException("Đã tồn tại lời mời đang chờ cho user này");
        }

        TeamInvitation invitation = new TeamInvitation();
        invitation.setTeam(team);
        invitation.setUser(target);
        invitation.setInvitedBy(currentUser);
        invitation.setMessage(request.getMessage());
        invitation.setStatus(TeamInvitation.InvitationStatus.PENDING);
        invitation.setExpiresAt(java.time.LocalDateTime.now().plusDays(INVITATION_EXPIRY_DAYS));

        TeamInvitation saved = teamInvitationRepository.save(invitation);

        notificationService.createNotification(
                target,
                Notification.NotificationType.TEAM_INVITATION,
                "Bạn được mời tham gia team " + team.getName(),
                request.getMessage() != null ? request.getMessage() : "Hãy tham gia cùng chúng tôi!",
                RELATED_ENTITY_TEAM,
                team.getTeamId());

        return toInvitationDTO(saved);
    }

    /**
     * Accept invitation -> thêm thành viên vào team
     */
    @Transactional
    public TeamResponseDTO acceptInvitation(Long invitationId) throws IdInvalidException {
        User currentUser = getCurrentUserOrThrow();
        TeamInvitation invitation = teamInvitationRepository.findById(invitationId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy lời mời"));

        if (!invitation.getUser().getUserId().equals(currentUser.getUserId())) {
            throw new IdInvalidException("Bạn không có quyền xử lý lời mời này");
        }
        if (invitation.getStatus() != TeamInvitation.InvitationStatus.PENDING) {
            throw new IdInvalidException("Lời mời đã được xử lý");
        }
        if (invitation.getExpiresAt() != null && invitation.getExpiresAt().isBefore(java.time.LocalDateTime.now())) {
            invitation.setStatus(TeamInvitation.InvitationStatus.EXPIRED);
            teamInvitationRepository.save(invitation);
            throw new IdInvalidException("Lời mời đã hết hạn");
        }

        Team team = invitation.getTeam();
        if (!teamMemberRepository.existsByTeamAndUser(team, currentUser)) {
            TeamMember member = new TeamMember();
            member.setTeam(team);
            member.setUser(currentUser);
            member.setRole(SurveyPermissionRole.VIEWER);
            teamMemberRepository.save(member);
        }

        invitation.setStatus(TeamInvitation.InvitationStatus.ACCEPTED);
        invitation.setAcceptedAt(java.time.LocalDateTime.now());
        teamInvitationRepository.save(invitation);

        notificationService.createNotification(
                team.getOwner(),
                Notification.NotificationType.TEAM_MEMBER_ADDED,
                currentUser.getFullName() + " đã tham gia team",
                "Lời mời của bạn đã được chấp nhận",
                RELATED_ENTITY_TEAM,
                team.getTeamId());

        return toTeamResponseDTO(team);
    }

    /**
     * Reject invitation
     */
    @Transactional
    public void rejectInvitation(Long invitationId) throws IdInvalidException {
        User currentUser = getCurrentUserOrThrow();
        TeamInvitation invitation = teamInvitationRepository.findById(invitationId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy lời mời"));

        if (!invitation.getUser().getUserId().equals(currentUser.getUserId())) {
            throw new IdInvalidException("Bạn không có quyền xử lý lời mời này");
        }
        if (invitation.getStatus() != TeamInvitation.InvitationStatus.PENDING) {
            throw new IdInvalidException("Lời mời đã được xử lý");
        }

        invitation.setStatus(TeamInvitation.InvitationStatus.REJECTED);
        invitation.setRejectedAt(java.time.LocalDateTime.now());
        teamInvitationRepository.save(invitation);

        Team team = invitation.getTeam();
        // Gửi thông báo cho owner của team
        notificationService.createNotification(
                team.getOwner(),
                Notification.NotificationType.TEAM_INVITATION_REJECTED,
                currentUser.getFullName() + " đã từ chối lời mời",
                "Lời mời tới team " + team.getName() + " đã bị từ chối",
                RELATED_ENTITY_TEAM,
                team.getTeamId());
        
        // Nếu invitedBy khác owner, cũng gửi thông báo cho invitedBy
        if (!team.getOwner().getUserId().equals(invitation.getInvitedBy().getUserId())) {
            notificationService.createNotification(
                    invitation.getInvitedBy(),
                    Notification.NotificationType.TEAM_INVITATION_REJECTED,
                    currentUser.getFullName() + " đã từ chối lời mời",
                    "Lời mời tới team " + team.getName() + " đã bị từ chối",
                    RELATED_ENTITY_TEAM,
                    team.getTeamId());
        }
    }

    /**
     * Lấy danh sách invitations của current user
     */
    @Transactional(readOnly = true)
    public List<TeamInvitationResponseDTO> getMyInvitations() throws IdInvalidException {
        User currentUser = getCurrentUserOrThrow();
        return teamInvitationRepository.findByUser(currentUser).stream()
                .map(this::toInvitationDTO)
                .toList();
    }

    /**
     * Lấy danh sách invitations của một team
     * Chỉ OWNER của team mới có quyền xem
     */
    @Transactional(readOnly = true)
    public List<TeamInvitationResponseDTO> getTeamInvitations(Long teamId) throws IdInvalidException {
        User currentUser = getCurrentUserOrThrow();
        Team team = getTeamOrThrow(teamId);
        
        // Kiểm tra quyền: chỉ owner mới xem được
        ensureOwner(team, currentUser);
        
        return teamInvitationRepository.findByTeam(team).stream()
                .map(this::toInvitationDTO)
                .toList();
    }

    /**
     * Xóa thành viên khỏi team (dùng memberId)
     */
    @Transactional
    public TeamResponseDTO removeMember(Long teamId, Long memberId) throws IdInvalidException {
        User currentUser = getCurrentUserOrThrow();
        Team team = getTeamOrThrow(teamId);
        ensureOwner(team, currentUser);

        TeamMember member = teamMemberRepository.findById(memberId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy thành viên"));

        if (!member.getTeam().getTeamId().equals(teamId)) {
            throw new IdInvalidException("Thành viên không thuộc team này");
        }

        User removedUser = member.getUser();
        teamMemberRepository.delete(member);

        // Xóa tất cả permissions của user này trên các survey được share với team này
        surveyPermissionRepository.deleteByUserAndRestrictedTeam(removedUser, team);

        notificationService.createNotification(
                removedUser,
                Notification.NotificationType.TEAM_MEMBER_REMOVED,
                "Bạn đã bị xóa khỏi team " + team.getName(),
                "Liên hệ với chủ team nếu đây là nhầm lẫn",
                RELATED_ENTITY_TEAM,
                team.getTeamId());

        return toTeamResponseDTO(team);
    }

    /**
     * User tự rời team (không thể rời nếu là OWNER)
     */
    @Transactional
    public void leaveTeam(Long teamId) throws IdInvalidException {
        User currentUser = getCurrentUserOrThrow();
        Team team = getTeamOrThrow(teamId);

        TeamMember member = teamMemberRepository.findByTeamAndUser(team, currentUser)
                .orElseThrow(() -> new IdInvalidException("Bạn không phải là thành viên của team này"));

        if (member.getRole() == SurveyPermissionRole.OWNER) {
            throw new IdInvalidException("OWNER không thể rời team. Vui lòng chuyển quyền OWNER cho người khác trước.");
        }

        // Xóa member khỏi team
        teamMemberRepository.delete(member);

        // Xóa tất cả permissions của user này trên các survey được share với team này
        surveyPermissionRepository.deleteByUserAndRestrictedTeam(currentUser, team);

        // Gửi thông báo cho owner
        notificationService.createNotification(
                team.getOwner(),
                Notification.NotificationType.TEAM_MEMBER_LEFT,
                currentUser.getFullName() + " đã rời team " + team.getName(),
                "Thành viên đã tự rời khỏi team",
                RELATED_ENTITY_TEAM,
                team.getTeamId());
    }

    /**
     * Xóa team và tất cả dữ liệu liên quan (chỉ OWNER mới có quyền)
     * - Xóa tất cả permissions liên quan đến team
     * - Xóa tất cả team members
     * - Xóa tất cả team invitations
     * - Xóa team
     */
    @Transactional
    public void deleteTeam(Long teamId) throws IdInvalidException {
        User currentUser = getCurrentUserOrThrow();
        Team team = getTeamOrThrow(teamId);
        ensureOwner(team, currentUser);

        // Lưu thông tin team trước khi xóa để dùng cho thông báo
        String teamName = team.getName();
        Long savedTeamId = team.getTeamId();

        // Lấy danh sách members để gửi thông báo
        List<TeamMember> members = teamMemberRepository.findByTeam(team);
        List<User> memberUsers = members.stream()
                .map(TeamMember::getUser)
                .filter(user -> !user.getUserId().equals(currentUser.getUserId())) // Không gửi thông báo cho chính owner
                .toList();

        // 1. Xóa tất cả permissions liên quan đến team
        List<SurveyPermission> teamPermissions = surveyPermissionRepository.findByRestrictedTeam(team);
        surveyPermissionRepository.deleteAll(teamPermissions);

        // 2. Xóa tất cả team members
        teamMemberRepository.deleteAll(members);

        // 3. Xóa tất cả team invitations
        List<TeamInvitation> invitations = teamInvitationRepository.findByTeam(team);
        teamInvitationRepository.deleteAll(invitations);

        // 4. Xóa team
        teamRepository.delete(team);

        // 5. Gửi thông báo cho tất cả members (trừ owner)
        for (User memberUser : memberUsers) {
            notificationService.createNotification(
                    memberUser,
                    Notification.NotificationType.TEAM_DELETED,
                    "Team " + teamName + " đã bị xóa",
                    "Team mà bạn là thành viên đã bị xóa bởi chủ team",
                    RELATED_ENTITY_TEAM,
                    savedTeamId);
        }
    }

    /**
     * Lấy thông tin 1 team (phải là owner hoặc member)
     */
    @Transactional(readOnly = true)
    public TeamResponseDTO getTeamById(Long teamId) throws IdInvalidException {
        User currentUser = getCurrentUserOrThrow();
        Team team = getTeamOrThrow(teamId);
        ensureMemberOrOwner(team, currentUser);
        return toTeamResponseDTO(team);
    }

    /**
     * Lấy danh sách team của user hiện tại
     */
    @Transactional(readOnly = true)
    public List<TeamResponseDTO> getTeamsByUser() throws IdInvalidException {
        User currentUser = getCurrentUserOrThrow();
        List<Team> teams = teamRepository.findTeamsByOwnerOrMember(currentUser, currentUser);
        return teams.stream().map(this::toTeamResponseDTO).toList();
    }

    /**
     * Lấy danh sách members của team
     */
    @Transactional(readOnly = true)
    public List<TeamMemberResponseDTO> getTeamMembers(Long teamId) throws IdInvalidException {
        User currentUser = getCurrentUserOrThrow();
        Team team = getTeamOrThrow(teamId);
        ensureMemberOrOwner(team, currentUser);

        return teamMemberRepository.findByTeam(team).stream()
                .map(this::toMemberDTO)
                .toList();
    }

    /**
     * Lấy danh sách surveys đã share với team
     */
    @Transactional(readOnly = true)
    public TeamSurveysResponseDTO getTeamSurveys(Long teamId) throws IdInvalidException {
        User currentUser = getCurrentUserOrThrow();
        Team team = getTeamOrThrow(teamId);
        ensureMemberOrOwner(team, currentUser);

        // Tìm permissions có restricted_team_id = team (user permissions ràng buộc với team)
        List<SurveyPermission> permissions = surveyPermissionRepository.findByRestrictedTeam(team);

        // Lấy danh sách surveys unique từ permissions
        Map<Long, Survey> surveyMap = permissions.stream()
                .collect(Collectors.toMap(
                        p -> p.getSurvey().getSurveyId(),
                        SurveyPermission::getSurvey,
                        (existing, replacement) -> existing
                ));

        List<TeamSurveyResponseDTO> surveys = surveyMap.values().stream()
                .map(survey -> TeamSurveyResponseDTO.builder()
                        .surveyId(survey.getSurveyId())
                        .title(survey.getTitle())
                        .description(survey.getDescription())
                        .status(survey.getStatus() != null ? survey.getStatus().name() : null)
                        .ownerId(survey.getUser() != null ? survey.getUser().getUserId() : null)
                        .ownerName(survey.getUser() != null ? survey.getUser().getFullName() : null)
                        .permission(findPermissionRole(permissions, survey.getSurveyId()))
                        .createdAt(survey.getCreatedAt())
                        .updatedAt(survey.getUpdatedAt())
                        .build())
                .toList();

        // Build summary bao gồm cả owner (chỉ đếm owners là members của team)
        Map<String, Object> summary = buildPermissionSummary(permissions, surveyMap.values(), team);

        return TeamSurveysResponseDTO.builder()
                .surveys(surveys)
                .permissions(summary)
                .build();
    }

    // ===================== Helper methods =====================

    private User getCurrentUserOrThrow() throws IdInvalidException {
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new IdInvalidException("Vui lòng đăng nhập để tiếp tục");
        }
        return currentUser;
    }

    private Team getTeamOrThrow(Long teamId) throws IdInvalidException {
        return teamRepository.findById(teamId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy team"));
    }

    private void ensureOwner(Team team, User user) throws IdInvalidException {
        if (!team.getOwner().getUserId().equals(user.getUserId())) {
            throw new IdInvalidException("Chỉ chủ team mới có quyền thực hiện thao tác này");
        }
    }

    private void ensureMemberOrOwner(Team team, User user) throws IdInvalidException {
        if (team.getOwner().getUserId().equals(user.getUserId())) {
            return;
        }
        boolean isMember = teamMemberRepository.existsByTeamAndUser(team, user);
        if (!isMember) {
            throw new IdInvalidException("Bạn không thuộc team này");
        }
    }

    private String generateUniqueInviteCode() {
        SecureRandom random = new SecureRandom();
        final String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        String code;
        do {
            StringBuilder builder = new StringBuilder();
            for (int i = 0; i < INVITE_CODE_LENGTH; i++) {
                builder.append(alphabet.charAt(random.nextInt(alphabet.length())));
            }
            code = builder.toString();
        } while (teamRepository.existsByInviteCode(code));
        return code;
    }

    private TeamResponseDTO toTeamResponseDTO(Team team) {
        int memberCount = teamMemberRepository.findByTeam(team).size();
        return TeamResponseDTO.builder()
                .teamId(team.getTeamId())
                .name(team.getName())
                .description(team.getDescription())
                .inviteCode(team.getInviteCode())
                .ownerId(team.getOwner() != null ? team.getOwner().getUserId() : null)
                .ownerName(team.getOwner() != null ? team.getOwner().getFullName() : null)
                .createdAt(team.getCreatedAt())
                .updatedAt(team.getUpdatedAt())
                .memberCount(memberCount)
                .build();
    }

    private SurveyPermissionRole findPermissionRole(List<SurveyPermission> permissions, Long surveyId) {
        return permissions.stream()
                .filter(p -> p.getSurvey().getSurveyId().equals(surveyId))
                .map(SurveyPermission::getPermission)
                .findFirst()
                .orElse(null);
    }

    private Map<String, Object> buildPermissionSummary(List<SurveyPermission> permissions, java.util.Collection<Survey> surveys, Team team) {
        // Đếm permissions từ survey_permissions table
        Map<SurveyPermissionRole, Long> counts = permissions.stream()
                .collect(Collectors.groupingBy(SurveyPermission::getPermission, Collectors.counting()));

        // Đếm số unique owners (chỉ đếm owners là members của team hoặc là owner của team)
        long ownerCount = surveys.stream()
                .filter(s -> s.getUser() != null)
                .map(s -> s.getUser())
                .filter(owner -> {
                    // Kiểm tra owner có phải là owner của team không
                    if (team.getOwner() != null && team.getOwner().getUserId().equals(owner.getUserId())) {
                        return true;
                    }
                    // Kiểm tra owner có phải là member của team không
                    return teamMemberRepository.existsByTeamAndUser(team, owner);
                })
                .map(User::getUserId)
                .distinct()                          // Loại bỏ trùng lặp
                .count();                            // Đếm số unique owners

        Map<String, Object> summary = new HashMap<>();
        // Total = số permissions được share + số unique owners (chỉ tính owners là members)
        summary.put("total", permissions.size() + ownerCount);
        
        // Đếm từ permissions được share
        for (SurveyPermissionRole role : SurveyPermissionRole.values()) {
            if (role == SurveyPermissionRole.OWNER) {
                // Owner được đếm riêng từ surveys (chỉ tính owners là members của team)
                summary.put(role.name(), ownerCount);
            } else {
                summary.put(role.name(), counts.getOrDefault(role, 0L));
            }
        }
        return summary;
    }

    private TeamInvitationResponseDTO toInvitationDTO(TeamInvitation invitation) {
        return TeamInvitationResponseDTO.builder()
                .invitationId(invitation.getInvitationId())
                .teamId(invitation.getTeam() != null ? invitation.getTeam().getTeamId() : null)
                .teamName(invitation.getTeam() != null ? invitation.getTeam().getName() : null)
                .userId(invitation.getUser() != null ? invitation.getUser().getUserId() : null)
                .userEmail(invitation.getUser() != null ? invitation.getUser().getEmail() : null)
                .userName(invitation.getUser() != null ? invitation.getUser().getFullName() : null)
                .invitedById(invitation.getInvitedBy() != null ? invitation.getInvitedBy().getUserId() : null)
                .invitedByName(invitation.getInvitedBy() != null ? invitation.getInvitedBy().getFullName() : null)
                .status(invitation.getStatus() != null ? invitation.getStatus().name() : null)
                .message(invitation.getMessage())
                .expiresAt(invitation.getExpiresAt())
                .createdAt(invitation.getCreatedAt())
                .acceptedAt(invitation.getAcceptedAt())
                .rejectedAt(invitation.getRejectedAt())
                .build();
    }

    private TeamMemberResponseDTO toMemberDTO(TeamMember member) {
        return TeamMemberResponseDTO.builder()
                .memberId(member.getTeamMemberId())
                .userId(member.getUser() != null ? member.getUser().getUserId() : null)
                .fullName(member.getUser() != null ? member.getUser().getFullName() : null)
                .email(member.getUser() != null ? member.getUser().getEmail() : null)
                .role(member.getRole())
                .joinedAt(member.getJoinedAt())
                .build();
    }
}
