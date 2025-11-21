package vn.duytan.c1se09.smartsurvey.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.duytan.c1se09.smartsurvey.domain.request.team.TeamCreateRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.team.TeamInvitationRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.team.TeamResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.team.TeamMemberResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.team.TeamInvitationResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.team.TeamSurveysResponseDTO;
import vn.duytan.c1se09.smartsurvey.service.TeamService;
import vn.duytan.c1se09.smartsurvey.util.annotation.ApiMessage;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;

import jakarta.validation.Valid;
import java.util.List;

/**
 * REST Controller cho Team management
 */
@RestController
@RequestMapping("/api/teams")
@RequiredArgsConstructor
public class TeamController {

    private final TeamService teamService;

    /**
     * POST /api/teams
     * Tạo team mới
     */
    @PostMapping
    @ApiMessage("Create new team")
    public ResponseEntity<TeamResponseDTO> createTeam(@Valid @RequestBody TeamCreateRequestDTO request)
            throws IdInvalidException {
        TeamResponseDTO team = teamService.createTeam(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(team);
    }

    /**
     * PUT /api/teams/{teamId}
     * Cập nhật thông tin team (name, description)
     * Chỉ OWNER của team được phép cập nhật
     */
    @PutMapping("/{teamId}")
    @ApiMessage("Update team info")
    public ResponseEntity<TeamResponseDTO> updateTeam(
            @PathVariable Long teamId,
            @Valid @RequestBody TeamCreateRequestDTO request) throws IdInvalidException {
        TeamResponseDTO team = teamService.updateTeam(teamId, request);
        return ResponseEntity.ok(team);
    }

    /**
     * POST /api/teams/{teamId}/invitations
     * Gửi lời mời tham gia team
     * Chỉ OWNER của team được phép gửi invitation
     */
    @PostMapping("/{teamId}/invitations")
    @ApiMessage("Send team invitation")
    public ResponseEntity<TeamInvitationResponseDTO> sendInvitation(
            @PathVariable Long teamId,
            @Valid @RequestBody TeamInvitationRequestDTO request) throws IdInvalidException {
        TeamInvitationResponseDTO invitation = teamService.sendInvitation(teamId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(invitation);
    }


    /**
     * DELETE /api/teams/{teamId}/members/{memberId}
     * Xóa thành viên khỏi team
     * Chỉ OWNER của team được phép xóa thành viên
     */
    @DeleteMapping("/{teamId}/members/{memberId}")
    @ApiMessage("Remove member from team")
    public ResponseEntity<TeamResponseDTO> removeMember(
            @PathVariable Long teamId,
            @PathVariable Long memberId) throws IdInvalidException {
        TeamResponseDTO team = teamService.removeMember(teamId, memberId);
        return ResponseEntity.ok(team);
    }

    /**
     * GET /api/teams/{teamId}/members
     * Lấy danh sách members của team
     * Chỉ OWNER hoặc MEMBER của team mới có quyền xem
     */
    @GetMapping("/{teamId}/members")
    @ApiMessage("Get team members")
    public ResponseEntity<List<TeamMemberResponseDTO>> getTeamMembers(@PathVariable Long teamId)
            throws IdInvalidException {
        List<TeamMemberResponseDTO> members = teamService.getTeamMembers(teamId);
        return ResponseEntity.ok(members);
    }

    /**
     * GET /api/teams/{teamId}
     * Lấy thông tin team
     */
    @GetMapping("/{teamId}")
    @ApiMessage("Get team by id")
    public ResponseEntity<TeamResponseDTO> getTeam(@PathVariable Long teamId) throws IdInvalidException {
        TeamResponseDTO team = teamService.getTeamById(teamId);
        return ResponseEntity.ok(team);
    }

    /**
     * GET /api/teams
     * Lấy danh sách teams của user hiện tại
     */
    @GetMapping
    @ApiMessage("Get user's teams")
    public ResponseEntity<List<TeamResponseDTO>> getMyTeams() throws IdInvalidException {
        List<TeamResponseDTO> teams = teamService.getTeamsByUser();
        return ResponseEntity.ok(teams);
    }

    /**
     * GET /api/teams/{teamId}/surveys
     * Lấy danh sách surveys được share với team
     */
    @GetMapping("/{teamId}/surveys")
    @ApiMessage("Get surveys shared with team")
    public ResponseEntity<TeamSurveysResponseDTO> getTeamSurveys(@PathVariable Long teamId)
            throws IdInvalidException {
        TeamSurveysResponseDTO response = teamService.getTeamSurveys(teamId);
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/teams/invitations/me
     * Lấy danh sách invitations của user hiện tại
     */
    @GetMapping("/invitations/me")
    @ApiMessage("Get my team invitations")
    public ResponseEntity<List<TeamInvitationResponseDTO>> getMyInvitations() throws IdInvalidException {
        List<TeamInvitationResponseDTO> invitations = teamService.getMyInvitations();
        return ResponseEntity.ok(invitations);
    }

    /**
     * GET /api/teams/{teamId}/invitations
     * Lấy danh sách invitations của team
     * Chỉ OWNER của team mới có quyền xem
     */
    @GetMapping("/{teamId}/invitations")
    @ApiMessage("Get team invitations")
    public ResponseEntity<List<TeamInvitationResponseDTO>> getTeamInvitations(@PathVariable Long teamId)
            throws IdInvalidException {
        List<TeamInvitationResponseDTO> invitations = teamService.getTeamInvitations(teamId);
        return ResponseEntity.ok(invitations);
    }

    /**
     * POST /api/teams/invitations/{invitationId}/accept
     * Chấp nhận lời mời tham gia team
     */
    @PostMapping("/invitations/{invitationId}/accept")
    @ApiMessage("Accept team invitation")
    public ResponseEntity<TeamResponseDTO> acceptInvitation(
            @PathVariable Long invitationId) throws IdInvalidException {
        TeamResponseDTO team = teamService.acceptInvitation(invitationId);
        return ResponseEntity.ok(team);
    }

    /**
     * POST /api/teams/invitations/{invitationId}/reject
     * Từ chối lời mời tham gia team
     */
    @PostMapping("/invitations/{invitationId}/reject")
    @ApiMessage("Reject team invitation")
    public ResponseEntity<Void> rejectInvitation(
            @PathVariable Long invitationId) throws IdInvalidException {
        teamService.rejectInvitation(invitationId);
        return ResponseEntity.ok().build();
    }
}



