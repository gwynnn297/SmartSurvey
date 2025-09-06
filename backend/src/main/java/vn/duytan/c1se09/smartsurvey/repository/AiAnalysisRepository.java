package vn.duytan.c1se09.smartsurvey.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.duytan.c1se09.smartsurvey.domain.AiAnalysis;
import vn.duytan.c1se09.smartsurvey.domain.Survey;

import java.util.List;

/**
 * Repository cho AiAnalysis entity
 */
@Repository
public interface AiAnalysisRepository extends JpaRepository<AiAnalysis, Long> {
    List<AiAnalysis> findBySurvey(Survey survey);

    List<AiAnalysis> findBySurveyOrderByCreatedAtDesc(Survey survey);

    List<AiAnalysis> findByAnalysisType(AiAnalysis.AnalysisType analysisType);
}