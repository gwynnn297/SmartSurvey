package vn.duytan.c1se09.smartsurvey.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.duytan.c1se09.smartsurvey.domain.Team;
import vn.duytan.c1se09.smartsurvey.domain.User;

import java.util.List;
import java.util.Optional;

/**
 * Repository cho Team entity
 */
@Repository
public interface TeamRepository extends JpaRepository<Team, Long> {
    
    Optional<Team> findByInviteCode(String inviteCode);
    
    List<Team> findByOwner(User owner);
    
    @Query("SELECT t FROM Team t WHERE t.owner = :owner OR EXISTS (SELECT tm FROM TeamMember tm WHERE tm.team = t AND tm.user = :user)")
    List<Team> findTeamsByOwnerOrMember(@Param("owner") User owner, @Param("user") User user);
    
    boolean existsByInviteCode(String inviteCode);
}































