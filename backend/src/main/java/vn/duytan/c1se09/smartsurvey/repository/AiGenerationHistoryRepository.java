package vn.duytan.c1se09.smartsurvey.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.duytan.c1se09.smartsurvey.domain.AiGenerationHistory;
import vn.duytan.c1se09.smartsurvey.domain.Survey;
import vn.duytan.c1se09.smartsurvey.domain.Question;

import java.util.List;

/**
 * Repository cho AiGenerationHistory entity
 */
@Repository
public interface AiGenerationHistoryRepository extends JpaRepository<AiGenerationHistory, Long> {
    List<AiGenerationHistory> findBySurvey(Survey survey);

    List<AiGenerationHistory> findByQuestion(Question question);

    List<AiGenerationHistory> findBySurveyOrderByCreatedAtDesc(Survey survey);

    List<AiGenerationHistory> findByGenerationType(AiGenerationHistory.AiGenerationType generationType);
}