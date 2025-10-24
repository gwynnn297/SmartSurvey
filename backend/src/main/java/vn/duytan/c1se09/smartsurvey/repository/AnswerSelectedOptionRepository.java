package vn.duytan.c1se09.smartsurvey.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.duytan.c1se09.smartsurvey.domain.Answer;
import vn.duytan.c1se09.smartsurvey.domain.AnswerSelectedOption;

import java.util.List;

@Repository
public interface AnswerSelectedOptionRepository extends JpaRepository<AnswerSelectedOption, Long> {
    
    /**
     * Find all selected options for an answer
     */
    List<AnswerSelectedOption> findByAnswer(Answer answer);
    
    /**
     * Find all selected options for an answer by answer ID
     */
    @Query("SELECT aso FROM AnswerSelectedOption aso WHERE aso.answer.answerId = :answerId")
    List<AnswerSelectedOption> findByAnswerId(@Param("answerId") Long answerId);
    
    /**
     * Delete all selected options for an answer
     */
    void deleteByAnswer(Answer answer);
    
    /**
     * Get option IDs for an answer
     */
    @Query("SELECT aso.option.optionId FROM AnswerSelectedOption aso WHERE aso.answer.answerId = :answerId")
    List<Long> findOptionIdsByAnswerId(@Param("answerId") Long answerId);
}