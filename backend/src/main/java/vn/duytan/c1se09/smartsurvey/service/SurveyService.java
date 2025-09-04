package vn.duytan.c1se09.smartsurvey.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.duytan.c1se09.smartsurvey.domain.*;
import vn.duytan.c1se09.smartsurvey.repository.*;
import vn.duytan.c1se09.smartsurvey.util.constant.SurveyStatusEnum;

import java.util.List;

/**
 * Service xử lý logic business cho Survey
 */
@Service
@RequiredArgsConstructor
public class SurveyService {

    private final SurveyRepository surveyRepository;
    private final CategoryRepository categoryRepository;
    private final QuestionRepository questionRepository;
    private final OptionRepository optionRepository;
    private final ResponseRepository responseRepository;
    private final AnswerRepository answerRepository;
    private final AuthService authService;

    @Transactional
    public Survey createSurvey(String title, String description, Long categoryId) {
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new RuntimeException("User not authenticated");
        }

        Survey survey = new Survey();
        survey.setTitle(title);
        survey.setDescription(description);
        survey.setUser(currentUser);
        survey.setStatus(SurveyStatusEnum.draft);

        if (categoryId != null) {
            Category category = categoryRepository.findById(categoryId)
                    .orElseThrow(() -> new RuntimeException("Category not found"));
            survey.setCategory(category);
        }

        return surveyRepository.save(survey);
    }

    public List<Survey> getMySurveys() {
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new RuntimeException("User not authenticated");
        }
        return surveyRepository.findByUser(currentUser);
    }

    public Survey getSurveyById(Long surveyId) {
        return surveyRepository.findById(surveyId)
                .orElseThrow(() -> new RuntimeException("Survey not found"));
    }

    @Transactional
    public Survey updateSurveyStatus(Long surveyId, SurveyStatusEnum status) {
        Survey survey = getSurveyById(surveyId);

        // Kiểm tra quyền
        User currentUser = authService.getCurrentUser();
        if (!survey.getUser().getUserId().equals(currentUser.getUserId())) {
            throw new RuntimeException("No permission to update this survey");
        }

        survey.setStatus(status);
        return surveyRepository.save(survey);
    }

    @Transactional
    public void deleteSurvey(Long surveyId) {
        Survey survey = getSurveyById(surveyId);

        // Kiểm tra quyền
        User currentUser = authService.getCurrentUser();
        if (!survey.getUser().getUserId().equals(currentUser.getUserId())) {
            throw new RuntimeException("No permission to delete this survey");
        }

        surveyRepository.delete(survey);
    }

    public long getTotalSurveys() {
        return surveyRepository.count();
    }

    public long getMyTotalSurveys() {
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            return 0;
        }
        return surveyRepository.countByUser(currentUser);
    }
}