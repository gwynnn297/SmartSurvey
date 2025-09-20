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
public class OptionService {
    private final OptionRepository optionRepository;
    private final QuestionRepository questionRepository;
    private final AuthService authService;
    private final ActivityLogService activityLogService;

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

    @Transactional
    public OptionResponseDTO createOption(OptionCreateRequestDTO request) throws IdInvalidException {
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new IdInvalidException("Người dùng chưa xác thực");
        }

        // Kiểm tra question tồn tại và thuộc về user hiện tại
        Question question = questionRepository.findById(request.getQuestionId())
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy câu hỏi"));
        
        if (!question.getSurvey().getUser().getUserId().equals(currentUser.getUserId())) {
            throw new IdInvalidException("Bạn không có quyền thêm tùy chọn vào câu hỏi này");
        }

        Option option = new Option();
        option.setQuestion(question);
        option.setOptionText(request.getOptionText());

        Option saved = optionRepository.save(option);
        
        // Log activity
        activityLogService.log(
                ActivityLog.ActionType.add_question,
                saved.getOptionId(),
                "options",
                "Tạo tùy chọn mới: " + saved.getOptionText());

        return toOptionResponseDTO(saved);
    }

    public List<OptionResponseDTO> getOptionsByQuestion(Long questionId) throws IdInvalidException {
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new IdInvalidException("Người dùng chưa xác thực");
        }

        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy câu hỏi"));
        
        if (!question.getSurvey().getUser().getUserId().equals(currentUser.getUserId())) {
            throw new IdInvalidException("Bạn không có quyền xem tùy chọn của câu hỏi này");
        }

        List<Option> options = optionRepository.findByQuestion(question);
        return options.stream().map(this::toOptionResponseDTO).toList();
    }

    public OptionResponseDTO getOptionById(Long optionId) throws IdInvalidException {
        Option option = getOptionEntityById(optionId);
        
        // Kiểm tra quyền
        User currentUser = authService.getCurrentUser();
        if (!option.getQuestion().getSurvey().getUser().getUserId().equals(currentUser.getUserId())) {
            throw new IdInvalidException("Bạn không có quyền xem tùy chọn này");
        }
        
        return toOptionResponseDTO(option);
    }

    /**
     * Cập nhật tùy chọn (method gốc)
     */
    @Transactional
    public OptionResponseDTO updateOption(Long optionId, OptionUpdateRequestDTO request) throws IdInvalidException {
        Option option = getOptionEntityById(optionId);
        
        // Kiểm tra quyền
        User currentUser = authService.getCurrentUser();
        if (!option.getQuestion().getSurvey().getUser().getUserId().equals(currentUser.getUserId())) {
            throw new IdInvalidException("Bạn không có quyền cập nhật tùy chọn này");
        }

        if (request.getOptionText() != null && !request.getOptionText().isEmpty()) {
            option.setOptionText(request.getOptionText());
        }

        Option saved = optionRepository.save(option);
        
        activityLogService.log(
                ActivityLog.ActionType.edit_question,
                saved.getOptionId(),
                "options",
                "Cập nhật tùy chọn: " + saved.getOptionText());

        return toOptionResponseDTO(saved);
    }

    @Transactional
    public void deleteOption(Long optionId) throws IdInvalidException {
        Option option = getOptionEntityById(optionId);
        
        // Kiểm tra quyền
        User currentUser = authService.getCurrentUser();
        if (!option.getQuestion().getSurvey().getUser().getUserId().equals(currentUser.getUserId())) {
            throw new IdInvalidException("Bạn không có quyền xóa tùy chọn này");
        }

        optionRepository.delete(option);
        
        activityLogService.log(
                ActivityLog.ActionType.delete_question,
                optionId,
                "options",
                "Xóa tùy chọn: " + option.getOptionText());
    }

    public long getTotalOptions() {
        return optionRepository.count();
    }

    public long getOptionsCountByQuestion(Long questionId) throws IdInvalidException {
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy câu hỏi"));
        return optionRepository.countByQuestion(question);
    }

    /**
     * SPRINT 2: Tạo tùy chọn cho câu hỏi cụ thể và trả về response DTO
     */
    @Transactional
    public OptionCreateResponseDTO createOptionForQuestionWithResponse(Long questionId, OptionCreateRequestDTO request) throws IdInvalidException {
        
        // Tái sử dụng logic hiện tại
        OptionResponseDTO optionDTO = createOption(request);
        
        // Tạo response DTO
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

    /**
     * Tạo tùy chọn cho câu hỏi cụ thể (method mới)
     */
    @Transactional
    public OptionResponseDTO createOptionForQuestion(Long questionId, OptionCreateRequestDTO request) throws IdInvalidException {
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new IdInvalidException("Người dùng chưa xác thực");
        }

        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy câu hỏi"));
        
        if (!question.getSurvey().getUser().getUserId().equals(currentUser.getUserId())) {
            throw new IdInvalidException("Bạn không có quyền tạo tùy chọn cho câu hỏi này");
        }

        Option option = new Option();
        option.setQuestion(question);
        option.setOptionText(request.getOptionText());

        Option savedOption = optionRepository.save(option);
        
        // Log activity
        activityLogService.log(
                ActivityLog.ActionType.add_question,
                savedOption.getOptionId(),
                "options",
                "Tạo tùy chọn: " + request.getOptionText());
        
        return toOptionResponseDTO(savedOption);
    }

    /**
     * Cập nhật tùy chọn và trả về response DTO
     */
    @Transactional
    public OptionUpdateResponseDTO updateOptionWithResponse(Long optionId, OptionUpdateRequestDTO request) throws IdInvalidException {
        OptionResponseDTO updatedDTO = updateOption(optionId, request);
        
        // Tạo response DTO
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
}