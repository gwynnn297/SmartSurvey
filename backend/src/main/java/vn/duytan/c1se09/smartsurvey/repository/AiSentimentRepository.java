package vn.duytan.c1se09.smartsurvey.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.duytan.c1se09.smartsurvey.domain.AiSentiment;
import vn.duytan.c1se09.smartsurvey.domain.Survey;

import java.util.List;

/**
 * Repository cho AiSentiment entity
 */
@Repository
public interface AiSentimentRepository extends JpaRepository<AiSentiment, Long> {
    List<AiSentiment> findBySurvey(Survey survey);
    
    List<AiSentiment> findBySurveyOrderByCreatedAtDesc(Survey survey);
}

