package vn.duytan.c1se09.smartsurvey.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.duytan.c1se09.smartsurvey.domain.Team;
import vn.duytan.c1se09.smartsurvey.domain.TeamMember;
import vn.duytan.c1se09.smartsurvey.domain.User;

import java.util.List;
import java.util.Optional;

/**
 * Repository cho TeamMember entity
 */
@Repository
public interface TeamMemberRepository extends JpaRepository<TeamMember, Long> {
    
    Optional<TeamMember> findByTeamAndUser(Team team, User user);
    
    List<TeamMember> findByTeam(Team team);
    
    List<TeamMember> findByUser(User user);
    
    boolean existsByTeamAndUser(Team team, User user);
    
    @Query("SELECT tm FROM TeamMember tm WHERE tm.team = :team AND tm.user = :user")
    Optional<TeamMember> findMemberByTeamAndUser(@Param("team") Team team, @Param("user") User user);
}































