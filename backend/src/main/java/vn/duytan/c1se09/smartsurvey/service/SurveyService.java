package vn.duytan.c1se09.smartsurvey.service;

import vn.duytan.c1se09.smartsurvey.domain.response.survey.SurveyResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.survey.SurveyCreateRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.survey.SurveyUpdateRequestDTO;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.duytan.c1se09.smartsurvey.domain.*;
import vn.duytan.c1se09.smartsurvey.domain.ActivityLog;
import vn.duytan.c1se09.smartsurvey.repository.*;
import vn.duytan.c1se09.smartsurvey.util.constant.SurveyStatusEnum;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import vn.duytan.c1se09.smartsurvey.domain.response.survey.SurveyFetchResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.survey.SurveyPaginationDTO;

/**
 * Service xử lý logic business cho Survey
 */
@Service
@RequiredArgsConstructor
public class SurveyService {
    private final SurveyRepository surveyRepository;
    private final CategoryRepository categoryRepository;
    // Các repository khác có thể được dùng trong tương lai
    // (question/options/answers)
    private final AuthService authService;
    private final ActivityLogService activityLogService;

    public Survey getSurveyEntityById(Long surveyId) throws IdInvalidException {
        return surveyRepository.findById(surveyId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));
    }

    private SurveyResponseDTO toSurveyResponseDTO(Survey survey) {
        SurveyResponseDTO dto = new SurveyResponseDTO();
        dto.setId(survey.getSurveyId());
        dto.setTitle(survey.getTitle());
        dto.setDescription(survey.getDescription());
        dto.setStatus(survey.getStatus() != null ? survey.getStatus().name() : null);
        dto.setAiPrompt(survey.getAiPrompt());
        if (survey.getCategory() != null) {
            dto.setCategoryId(survey.getCategory().getCategoryId());
            dto.setCategoryName(survey.getCategory().getCategoryName());
        }
        if (survey.getUser() != null) {
            dto.setUserId(survey.getUser().getUserId());
            dto.setUserName(survey.getUser().getFullName());
        }
        dto.setCreatedAt(survey.getCreatedAt());
        dto.setUpdatedAt(survey.getUpdatedAt());
        return dto;
    }

    public Category getCategoryById(Long categoryId) throws IdInvalidException {
        return categoryRepository.findById(categoryId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy danh mục"));
    }

    @Transactional
    public Survey updateSurvey(Survey survey) {
        // Có thể bổ sung kiểm tra quyền, validation tại đây
        return surveyRepository.save(survey);
    }

    @Transactional
    public SurveyResponseDTO createSurvey(SurveyCreateRequestDTO request) throws IdInvalidException {
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new IdInvalidException("Người dùng chưa xác thực");
        }

        Survey survey = new Survey();
        survey.setTitle(request.getTitle());
        survey.setDescription(request.getDescription());
        survey.setUser(currentUser);
        survey.setStatus(SurveyStatusEnum.draft);
        survey.setAiPrompt(request.getAiPrompt());

        if (request.getCategoryId() != null) {
            Category category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new IdInvalidException("Không tìm thấy danh mục"));
            survey.setCategory(category);
        }

        Survey saved = surveyRepository.save(survey);
        // log activity
        activityLogService.log(
                ActivityLog.ActionType.create_survey,
                saved.getSurveyId(),
                "surveys",
                "Tạo khảo sát mới: " + saved.getTitle());
        return toSurveyResponseDTO(saved);
    }

    public List<SurveyResponseDTO> getMySurveys() throws IdInvalidException {
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new IdInvalidException("Người dùng chưa xác thực");
        }
        List<Survey> surveys = surveyRepository.findByUser(currentUser);
        return surveys.stream().map(this::toSurveyResponseDTO).toList();
    }

    public SurveyPaginationDTO getMySurveysPaginated(int page, int size) throws IdInvalidException {
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new IdInvalidException("Người dùng chưa xác thực");
        }
        if (page < 0)
            page = 0;
        if (size <= 0 || size > 100)
            size = 10;
        Pageable pageable = PageRequest.of(page, size);
        Page<Survey> surveyPage = surveyRepository.findByUser(currentUser, pageable);
        SurveyPaginationDTO dto = new SurveyPaginationDTO();
        SurveyPaginationDTO.Meta meta = new SurveyPaginationDTO.Meta();
        meta.setPage(page);
        meta.setPageSize(size);
        meta.setPages(surveyPage.getTotalPages());
        meta.setTotal(surveyPage.getTotalElements());
        dto.setMeta(meta);
        dto.setResult(surveyPage.getContent().stream().map(s -> {
            SurveyFetchResponseDTO f = new SurveyFetchResponseDTO();
            f.setId(s.getSurveyId());
            f.setTitle(s.getTitle());
            f.setDescription(s.getDescription());
            f.setStatus(s.getStatus() != null ? s.getStatus().name() : null);
            f.setAiPrompt(s.getAiPrompt());
            if (s.getCategory() != null) {
                f.setCategoryId(s.getCategory().getCategoryId());
                f.setCategoryName(s.getCategory().getCategoryName());
            }
            if (s.getUser() != null) {
                f.setUserId(s.getUser().getUserId());
                f.setUserName(s.getUser().getFullName());
            }
            f.setCreatedAt(s.getCreatedAt());
            f.setUpdatedAt(s.getUpdatedAt());
            return f;
        }).toList());
        return dto;
    }

    public SurveyResponseDTO getSurveyById(Long surveyId) throws IdInvalidException {
        Survey survey = getSurveyEntityById(surveyId);
        return toSurveyResponseDTO(survey);
    }

    @Transactional
    public Survey updateSurveyStatus(Long surveyId, SurveyStatusEnum status) throws IdInvalidException {
        Survey survey = getSurveyEntityById(surveyId);
        User currentUser = authService.getCurrentUser();
        if (!survey.getUser().getUserId().equals(currentUser.getUserId())) {
            throw new IdInvalidException("Bạn không có quyền cập nhật khảo sát này");
        }
        survey.setStatus(status);
        return surveyRepository.save(survey);
    }

    @Transactional
    public SurveyResponseDTO updateSurvey(Long surveyId, SurveyUpdateRequestDTO request) throws IdInvalidException {
        Survey survey = getSurveyEntityById(surveyId);
        User currentUser = authService.getCurrentUser();
        if (!survey.getUser().getUserId().equals(currentUser.getUserId())) {
            throw new IdInvalidException("Bạn không có quyền cập nhật khảo sát này");
        }

        if (request.getTitle() != null && !request.getTitle().isEmpty()) {
            survey.setTitle(request.getTitle());
        }
        if (request.getDescription() != null) {
            survey.setDescription(request.getDescription());
        }
        if (request.getCategoryId() != null) {
            Category category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new IdInvalidException("Không tìm thấy danh mục"));
            survey.setCategory(category);
        }
        if (request.getStatus() != null) {
            survey.setStatus(request.getStatus());
        }
        if (request.getAiPrompt() != null) {
            survey.setAiPrompt(request.getAiPrompt());
        }

        Survey saved = surveyRepository.save(survey);
        activityLogService.log(
                ActivityLog.ActionType.edit_survey,
                saved.getSurveyId(),
                "surveys",
                "Cập nhật khảo sát: " + saved.getTitle());
        return toSurveyResponseDTO(saved);
        // https://www.facebook.com/groups/?ref=bookmarks
    }

    @Transactional
    public void deleteSurvey(Long surveyId) throws IdInvalidException {
        Survey survey = getSurveyEntityById(surveyId);

        // Kiểm tra quyền
        User currentUser = authService.getCurrentUser();
        if (!survey.getUser().getUserId().equals(currentUser.getUserId())) {
            throw new IdInvalidException("Bạn không có quyền xóa khảo sát này");
        }

        surveyRepository.delete(survey);
        activityLogService.log(
                ActivityLog.ActionType.delete_survey,
                surveyId,
                "surveys",
                "Xóa khảo sát: " + survey.getTitle());
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