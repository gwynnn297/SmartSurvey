package vn.duytan.c1se09.smartsurvey.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.duytan.c1se09.smartsurvey.domain.Survey;
import vn.duytan.c1se09.smartsurvey.domain.SurveyPermission;
import vn.duytan.c1se09.smartsurvey.domain.Team;
import vn.duytan.c1se09.smartsurvey.domain.User;

import java.util.List;
import java.util.Optional;

/**
 * Repository cho SurveyPermission entity
 */
@Repository
public interface SurveyPermissionRepository extends JpaRepository<SurveyPermission, Long> {
    
    @Query("SELECT sp FROM SurveyPermission sp " +
           "LEFT JOIN FETCH sp.user " +
           "LEFT JOIN FETCH sp.restrictedTeam " +
           "LEFT JOIN FETCH sp.grantedBy " +
           "WHERE sp.survey = :survey")
    List<SurveyPermission> findBySurvey(@Param("survey") Survey survey);
    
    /**
     * Tìm permissions có restricted_team_id = team (user permissions ràng buộc với team)
     */
    @Query("SELECT sp FROM SurveyPermission sp WHERE sp.restrictedTeam = :team")
    List<SurveyPermission> findByRestrictedTeam(@Param("team") Team team);
    
    List<SurveyPermission> findByUser(User user);
    
    Optional<SurveyPermission> findBySurveyAndUser(Survey survey, User user);
    
    @Query("SELECT sp FROM SurveyPermission sp WHERE sp.survey = :survey AND (sp.user = :user OR (sp.restrictedTeam IS NOT NULL AND EXISTS (SELECT tm FROM TeamMember tm WHERE tm.team = sp.restrictedTeam AND tm.user = :user)))")
    List<SurveyPermission> findPermissionsForUser(@Param("survey") Survey survey, @Param("user") User user);
    
    @Query("SELECT s FROM Survey s WHERE s.user = :user OR EXISTS (SELECT sp FROM SurveyPermission sp WHERE sp.survey = s AND sp.user = :user) OR EXISTS (SELECT sp FROM SurveyPermission sp WHERE sp.survey = s AND sp.restrictedTeam IS NOT NULL AND EXISTS (SELECT tm FROM TeamMember tm WHERE tm.team = sp.restrictedTeam AND tm.user = :user))")
    List<Survey> findSurveysAccessibleByUser(@Param("user") User user);

    void deleteByUserAndRestrictedTeam(User user, Team restrictedTeam);
}



















