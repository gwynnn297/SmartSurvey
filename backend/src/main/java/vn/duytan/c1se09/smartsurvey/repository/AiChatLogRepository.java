package vn.duytan.c1se09.smartsurvey.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.duytan.c1se09.smartsurvey.domain.AiChatLog;
import vn.duytan.c1se09.smartsurvey.domain.Survey;
import vn.duytan.c1se09.smartsurvey.domain.User;

import java.util.List;

/**
 * Repository cho AiChatLog entity
 */
@Repository
public interface AiChatLogRepository extends JpaRepository<AiChatLog, Long> {
    List<AiChatLog> findBySurvey(Survey survey);

    List<AiChatLog> findByUser(User user);

    List<AiChatLog> findBySurveyOrderByCreatedAtDesc(Survey survey);

    List<AiChatLog> findByUserOrderByCreatedAtDesc(User user);
}