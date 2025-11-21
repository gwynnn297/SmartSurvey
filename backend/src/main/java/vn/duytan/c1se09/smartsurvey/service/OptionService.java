package vn.duytan.c1se09.smartsurvey.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.duytan.c1se09.smartsurvey.domain.*;
import vn.duytan.c1se09.smartsurvey.domain.request.option.OptionCreateRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.option.OptionUpdateRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.option.OptionResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.option.OptionCreateResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.option.OptionUpdateResponseDTO;
import vn.duytan.c1se09.smartsurvey.repository.*;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;

import java.util.List;

/**
 * Service xử lý logic business cho Option
 */
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class OptionService {
    private final OptionRepository optionRepository;
    private final QuestionRepository questionRepository;
    private final AuthService authService;
    private final ActivityLogService activityLogService;
    private final SurveyPermissionService surveyPermissionService;

    public Option getOptionEntityById(Long optionId) throws IdInvalidException {
        return optionRepository.findById(optionId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy tùy chọn"));
    }

    private OptionResponseDTO toOptionResponseDTO(Option option) {
        OptionResponseDTO dto = new OptionResponseDTO();
        dto.setId(option.getOptionId());
        dto.setQuestionId(option.getQuestion().getQuestionId());
        dto.setQuestionText(option.getQuestion().getQuestionText());
        dto.setOptionText(option.getOptionText());
       
        dto.setCreatedAt(option.getCreatedAt());
        dto.setUpdatedAt(option.getUpdatedAt());
        return dto;
    }

    /**
     * Validate permission để EDIT (create/update/delete options)
     * Chỉ OWNER và EDITOR được phép
     */
    private void validateEditPermission(Question question) throws IdInvalidException {
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new IdInvalidException("Người dùng chưa xác thực");
        }

        if (!surveyPermissionService.canEdit(question.getSurvey(), currentUser)) {
            throw new IdInvalidException("Bạn không có quyền chỉnh sửa khảo sát này");
        }
    }

    /**
     * Validate permission để VIEW (xem options)
     * OWNER, EDITOR, ANALYST, VIEWER đều được phép
     */
    private void validateViewPermission(Question question) throws IdInvalidException {
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new IdInvalidException("Người dùng chưa xác thực");
        }

        if (!surveyPermissionService.canViewSurvey(question.getSurvey(), currentUser)) {
            throw new IdInvalidException("Bạn không có quyền xem khảo sát này");
        }
    }

    /**
     * Tạo tùy chọn mới (phương thức chính)
     * 
     * @param questionId
     * @param request
     * @return
     */
    @Transactional
    public OptionResponseDTO createOption(Long questionId, OptionCreateRequestDTO request) throws IdInvalidException {

        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy câu hỏi"));

        validateEditPermission(question);

        Option option = new Option();
        option.setQuestion(question);
        option.setOptionText(request.getOptionText());
       

        Option saved = optionRepository.save(option);

        activityLogService.log(
                ActivityLog.ActionType.add_option,
                saved.getOptionId(),
                "options",
                "Tạo tùy chọn: " + saved.getOptionText());

        return toOptionResponseDTO(saved);
    }

    /**
     * Tạo tùy chọn mới với response message
     * 
     * @param questionId
     * @param request
     * @return
     */
    @Transactional
    public OptionCreateResponseDTO createOptionWithResponse(Long questionId, OptionCreateRequestDTO request)
            throws IdInvalidException {
        OptionResponseDTO optionDTO = createOption(questionId, request);

        // Convert to create response DTO
        OptionCreateResponseDTO response = new OptionCreateResponseDTO();
        response.setId(optionDTO.getId());
        response.setQuestionId(optionDTO.getQuestionId());
        response.setQuestionText(optionDTO.getQuestionText());
        response.setOptionText(optionDTO.getOptionText());
        
        response.setMessage("Tạo tùy chọn thành công!");
        response.setCreatedAt(optionDTO.getCreatedAt());
        response.setUpdatedAt(optionDTO.getUpdatedAt());

        return response;
    }

    // Đọc danh sách câu trả lời của câu hỏi

    public List<OptionResponseDTO> getOptionsByQuestion(Long questionId) throws IdInvalidException {
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy câu hỏi"));

        validateViewPermission(question);

        List<Option> options = optionRepository.findByQuestion(question);
        return options.stream().map(this::toOptionResponseDTO).toList();
    }

    public OptionResponseDTO getOptionById(Long optionId) throws IdInvalidException {
        Option option = getOptionEntityById(optionId);
        validateViewPermission(option.getQuestion());
        return toOptionResponseDTO(option);
    }

    /**
     * Cập nhật tùy chọn
     * 
     * @param optionId
     * @param request
     * @return
     */
    @Transactional
    public OptionResponseDTO updateOption(Long optionId, OptionUpdateRequestDTO request) throws IdInvalidException {
        Option option = getOptionEntityById(optionId);
        validateEditPermission(option.getQuestion());

        if (request.getOptionText() != null && !request.getOptionText().isEmpty()) {
            option.setOptionText(request.getOptionText());
        }
      

        Option saved = optionRepository.save(option);

        activityLogService.log(
                ActivityLog.ActionType.edit_option,
                saved.getOptionId(),
                "options",
                "Cập nhật tùy chọn: " + saved.getOptionText());

        return toOptionResponseDTO(saved);
    }

    /**
     * Cập nhật tùy chọn với response message
     * 
     * @param optionId
     * @param request
     * @return
     */
    @Transactional
    public OptionUpdateResponseDTO updateOptionWithResponse(Long optionId, OptionUpdateRequestDTO request)
            throws IdInvalidException {
        OptionResponseDTO updatedDTO = updateOption(optionId, request);

        OptionUpdateResponseDTO response = new OptionUpdateResponseDTO();
        response.setId(updatedDTO.getId());
        response.setQuestionId(updatedDTO.getQuestionId());
        response.setQuestionText(updatedDTO.getQuestionText());
        response.setOptionText(updatedDTO.getOptionText());
        response.setMessage("Cập nhật tùy chọn thành công!");
        response.setCreatedAt(updatedDTO.getCreatedAt());
        response.setUpdatedAt(updatedDTO.getUpdatedAt());

        return response;
    }

    // xóa câu trả lời

    @Transactional
    public void deleteOption(Long optionId) throws IdInvalidException {
        Option option = getOptionEntityById(optionId);
        validateEditPermission(option.getQuestion());

        optionRepository.delete(option);

        activityLogService.log(
                ActivityLog.ActionType.delete_option,
                optionId,
                "options",
                "Xóa tùy chọn: " + option.getOptionText());
    }

    // Tổng số tùy chọn trong hệ thống

    public long getTotalOptions() {
        return optionRepository.count();
    }

    // Số tùy chọn của một câu hỏi cụ thể
    public long getOptionsCountByQuestion(Long questionId) throws IdInvalidException {
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy câu hỏi"));
        return optionRepository.countByQuestion(question);
    }
}