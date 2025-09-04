package vn.duytan.c1se09.smartsurvey.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.duytan.c1se09.smartsurvey.domain.Option;
import vn.duytan.c1se09.smartsurvey.domain.Question;

import java.util.List;

/**
 * Repository cho Option entity
 */
@Repository
public interface OptionRepository extends JpaRepository<Option, Long> {
    List<Option> findByQuestion(Question question);

    List<Option> findByQuestionOrderByCreatedAt(Question question);

    long countByQuestion(Question question);
}