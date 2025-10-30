package vn.duytan.c1se09.smartsurvey.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.duytan.c1se09.smartsurvey.domain.Question;
import vn.duytan.c1se09.smartsurvey.domain.Survey;

import java.util.List;

/**
 * Repository cho Question entity
 */
@Repository
public interface QuestionRepository extends JpaRepository<Question, Long> {
    List<Question> findBySurvey(Survey survey);

    List<Question> findBySurveyOrderByCreatedAt(Survey survey);

    long countBySurvey(Survey survey);

    List<Question> findBySurveyOrderByDisplayOrderAsc(Survey survey);

    @Query("SELECT COALESCE(MAX(q.displayOrder), 0) FROM Question q WHERE q.survey = :survey")
    int findMaxDisplayOrderBySurvey(@Param("survey") Survey survey);
    
    List<Question> findBySurveyAndIsRequiredTrue(Survey survey);
}