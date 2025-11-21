package vn.duytan.c1se09.smartsurvey.domain.response.team;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO trả về thông tin invitation
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeamInvitationResponseDTO {
    private Long invitationId;
    private Long teamId;
    private String teamName;
    private Long userId;
    private String userEmail;
    private String userName;
    private Long invitedById;
    private String invitedByName;
    private String status;
    private String message;
    private LocalDateTime expiresAt;
    private LocalDateTime createdAt;
    private LocalDateTime acceptedAt;
    private LocalDateTime rejectedAt;
}






