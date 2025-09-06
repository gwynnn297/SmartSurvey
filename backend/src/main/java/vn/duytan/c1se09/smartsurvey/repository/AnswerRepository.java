package vn.duytan.c1se09.smartsurvey.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.duytan.c1se09.smartsurvey.domain.Answer;
import vn.duytan.c1se09.smartsurvey.domain.Response;
import vn.duytan.c1se09.smartsurvey.domain.Question;

import java.util.List;

/**
 * Repository cho Answer entity
 */
@Repository
public interface AnswerRepository extends JpaRepository<Answer, Long> {
    List<Answer> findByResponse(Response response);

    List<Answer> findByQuestion(Question question);

    List<Answer> findByResponseAndQuestion(Response response, Question question);

    long countByQuestion(Question question);

    long countByResponse(Response response);
}