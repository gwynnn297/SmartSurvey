package vn.duytan.c1se09.smartsurvey.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.duytan.c1se09.smartsurvey.domain.request.option.OptionCreateRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.option.OptionUpdateRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.option.OptionResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.option.OptionCreateResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.option.OptionUpdateResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.option.OptionDeleteResponseDTO;
import vn.duytan.c1se09.smartsurvey.service.OptionService;
import vn.duytan.c1se09.smartsurvey.util.annotation.ApiMessage;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;

import jakarta.validation.Valid;
import java.util.List;

/**
 * REST Controller cho Option management
 */
@RestController
@RequiredArgsConstructor
public class OptionController {
    private final OptionService optionService;

    /**
     *  Tạo tùy chọn cho câu hỏi cụ thể
     */
    @PostMapping("/questions/{questionId}/options")
    @ApiMessage("Create new option for question")
    public ResponseEntity<OptionCreateResponseDTO> createOptionForQuestion(
            @PathVariable("questionId") Long questionId,
            @Valid @RequestBody OptionCreateRequestDTO request) throws IdInvalidException {
        
        // Override questionId từ path parameter nếu chưa có
        if (request.getQuestionId() == null) {
            request.setQuestionId(questionId);
        }
        
        // Gọi service method trực tiếp
        OptionCreateResponseDTO response = optionService.createOptionWithResponse(questionId, request);
        return ResponseEntity.ok(response);
    }

    /**
     * Lấy danh sách tùy chọn theo question
     */
    @GetMapping("/options/question/{questionId}")
    @ApiMessage("Get options by question")
    public ResponseEntity<List<OptionResponseDTO>> getOptionsByQuestion(@PathVariable("questionId") Long questionId) 
            throws IdInvalidException {
        List<OptionResponseDTO> options = optionService.getOptionsByQuestion(questionId);
        return ResponseEntity.ok(options);
    }

    /**
     * Lấy chi tiết tùy chọn theo id
     */
    @GetMapping("/options/{id}")
    @ApiMessage("Get option detail")
    public ResponseEntity<OptionResponseDTO> getOptionDetail(@PathVariable("id") Long id) 
            throws IdInvalidException {
        OptionResponseDTO optionDTO = optionService.getOptionById(id);
        return ResponseEntity.ok(optionDTO);
    }

    /**
     * Cập nhật tùy chọn
     */
    @PutMapping("/options/{id}")
    @ApiMessage("Update option")
    public ResponseEntity<OptionUpdateResponseDTO> updateOption(@PathVariable("id") Long id,
            @Valid @RequestBody OptionUpdateRequestDTO request) throws IdInvalidException {
        OptionUpdateResponseDTO response = optionService.updateOptionWithResponse(id, request);
        return ResponseEntity.ok(response);
    }

    /**
     * Xóa tùy chọn
     */
    @DeleteMapping("/options/{id}")
    @ApiMessage("Delete option")
    public ResponseEntity<OptionDeleteResponseDTO> deleteOption(@PathVariable("id") Long id) 
            throws IdInvalidException {
        optionService.deleteOption(id);
        OptionDeleteResponseDTO response = new OptionDeleteResponseDTO(id, "Xóa tùy chọn thành công");
        return ResponseEntity.ok(response);
    }
}