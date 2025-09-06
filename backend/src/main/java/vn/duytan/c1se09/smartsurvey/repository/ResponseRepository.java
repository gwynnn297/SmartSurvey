package vn.duytan.c1se09.smartsurvey.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.duytan.c1se09.smartsurvey.domain.Response;
import vn.duytan.c1se09.smartsurvey.domain.Survey;
import vn.duytan.c1se09.smartsurvey.domain.User;

import java.util.List;
import java.util.Optional;

/**
 * Repository cho Response entity
 */
@Repository
public interface ResponseRepository extends JpaRepository<Response, Long> {
    List<Response> findBySurvey(Survey survey);

    List<Response> findByUser(User user);

    List<Response> findBySurveyAndUser(Survey survey, User user);

    long countBySurvey(Survey survey);

    Optional<Response> findByRequestToken(String requestToken);

    boolean existsByRequestToken(String requestToken);

    @Query("SELECT COUNT(DISTINCT r.user) FROM Response r WHERE r.survey = :survey")
    long countDistinctUsersBySurvey(@Param("survey") Survey survey);
}