package vn.duytan.c1se09.smartsurvey.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.duytan.c1se09.smartsurvey.domain.*;
import vn.duytan.c1se09.smartsurvey.domain.request.option.OptionCreateRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.option.OptionUpdateRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.option.OptionResponseDTO;
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
}