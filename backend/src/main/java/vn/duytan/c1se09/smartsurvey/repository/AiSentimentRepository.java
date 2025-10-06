package vn.duytan.c1se09.smartsurvey.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.duytan.c1se09.smartsurvey.domain.AiSentiment;
import vn.duytan.c1se09.smartsurvey.domain.Survey;

import java.util.List;
import java.util.Optional;

/**
 * Repository cho AiSentiment entity
 */
@Repository
public interface AiSentimentRepository extends JpaRepository<AiSentiment, Long> {
    
    AiSentiment findBySurvey(Survey survey);
    boolean existsBySurvey(Survey survey);
    
    @Query("SELECT a FROM AiSentiment a WHERE a.survey.surveyId = :surveyId ORDER BY a.sentimentId DESC")
    Optional<AiSentiment> findLatestBySurveyId(@Param("surveyId") Long surveyId);

    @Query("SELECT a FROM AiSentiment a WHERE a.survey.surveyId = :surveyId ORDER BY a.sentimentId DESC")
    List<AiSentiment> findAllBySurveyId(@Param("surveyId") Long surveyId);
    boolean existsBySurveySurveyId(Long surveyId);
}