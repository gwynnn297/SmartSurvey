package vn.duytan.c1se09.smartsurvey.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.duytan.c1se09.smartsurvey.domain.Response;
import vn.duytan.c1se09.smartsurvey.domain.Survey;
import vn.duytan.c1se09.smartsurvey.domain.User;

import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;

/**
 * Repository cho Response entity
 */
@Repository
public interface ResponseRepository extends JpaRepository<Response, Long> {
    List<Response> findBySurvey(Survey survey);
    
    // removed filtering APIs per request

    List<Response> findByUser(User user);

    List<Response> findBySurveyAndUser(Survey survey, User user);

    // removed counting per request

    Optional<Response> findByRequestToken(String requestToken);

    boolean existsByRequestToken(String requestToken);

    @Query("""
        select distinct r from Response r
        left join Answer a on a.response = r
        left join Option o on a.option = o
        left join Question q on a.question = q
        where r.survey = :survey
          and (:from is null or r.submittedAt >= :from)
          and (:to is null or r.submittedAt <= :to)
          and (:userId is null or (r.user is not null and r.user.userId = :userId))
          and (:requestToken is null or r.requestToken like concat('%', :requestToken, '%'))
          and (
               :search is null or (
                   (a.answerText is not null and a.answerText like concat('%', :search, '%'))
                   or (o.optionText is not null and o.optionText like concat('%', :search, '%'))
                   or (q.questionText is not null and q.questionText like concat('%', :search, '%'))
               )
          )
          and (
               :status is null or (
                   :status = 'completed' and (
                       (select count(distinct q.questionId) from Question q where q.survey = r.survey and q.isRequired = true)
                       =
                       (select count(distinct a2.question.questionId) from Answer a2 where a2.response = r and a2.question.isRequired = true)
                   )
               ) or (
                   :status = 'dropped' and not exists (select a3 from Answer a3 where a3.response = r)
               ) or (
                   :status = 'partial' and exists (select a4 from Answer a4 where a4.response = r)
                       and (
                           (select count(distinct q2.questionId) from Question q2 where q2.survey = r.survey and q2.isRequired = true)
                           <>
                           (select count(distinct a5.question.questionId) from Answer a5 where a5.response = r and a5.question.isRequired = true)
                       )
               )
          )
        """)
    Page<Response> findPageBySurveyWithFilters(
            @Param("survey") Survey survey,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to,
            @Param("userId") Long userId,
            @Param("requestToken") String requestToken,
            @Param("search") String search,
            @Param("status") String completionStatus,
            Pageable pageable);
}