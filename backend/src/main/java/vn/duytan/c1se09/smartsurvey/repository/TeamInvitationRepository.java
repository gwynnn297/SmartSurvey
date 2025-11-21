package vn.duytan.c1se09.smartsurvey.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.duytan.c1se09.smartsurvey.domain.Team;
import vn.duytan.c1se09.smartsurvey.domain.TeamInvitation;
import vn.duytan.c1se09.smartsurvey.domain.User;

import java.util.List;
import java.util.Optional;

@Repository
public interface TeamInvitationRepository extends JpaRepository<TeamInvitation, Long> {
    
    // Tìm invitation theo team và user với status PENDING
    Optional<TeamInvitation> findByTeamAndUserAndStatus(Team team, User user, TeamInvitation.InvitationStatus status);
    
    // Tìm tất cả invitations của một user
    List<TeamInvitation> findByUser(User user);
    
    // Tìm tất cả invitations của một user với status cụ thể
    List<TeamInvitation> findByUserAndStatus(User user, TeamInvitation.InvitationStatus status);
    
    // Tìm tất cả invitations của một team
    List<TeamInvitation> findByTeam(Team team);
    
    // Tìm tất cả invitations của một team với status cụ thể
    List<TeamInvitation> findByTeamAndStatus(Team team, TeamInvitation.InvitationStatus status);
    
    // Kiểm tra xem đã có invitation PENDING cho team và user chưa
    boolean existsByTeamAndUserAndStatus(Team team, User user, TeamInvitation.InvitationStatus status);
}












