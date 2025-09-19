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
@RequestMapping("/options")
@RequiredArgsConstructor
public class OptionController {
    private final OptionService optionService;

    /**
     * Tạo tùy chọn mới
     */
    @PostMapping
    @ApiMessage("Create new option")
    public ResponseEntity<OptionCreateResponseDTO> createOption(@Valid @RequestBody OptionCreateRequestDTO request)
            throws IdInvalidException {
        var optionDTO = optionService.createOption(request);
        
        // Tạo response DTO riêng cho create
        OptionCreateResponseDTO response = new OptionCreateResponseDTO();
        response.setId(optionDTO.getId());
        response.setQuestionId(optionDTO.getQuestionId());
        response.setQuestionText(optionDTO.getQuestionText());
        response.setOptionText(optionDTO.getOptionText());
        response.setMessage("Tạo tùy chọn thành công!");
        response.setCreatedAt(optionDTO.getCreatedAt());
        response.setUpdatedAt(optionDTO.getUpdatedAt());
        
        return ResponseEntity.ok(response);
    }

    /**
     * Lấy danh sách tùy chọn theo question
     */
    @GetMapping("/question/{questionId}")
    @ApiMessage("Get options by question")
    public ResponseEntity<List<OptionResponseDTO>> getOptionsByQuestion(@PathVariable("questionId") Long questionId) 
            throws IdInvalidException {
        var options = optionService.getOptionsByQuestion(questionId);
        return ResponseEntity.ok(options);
    }

    /**
     * Lấy chi tiết tùy chọn theo id
     */
    @GetMapping("/{id}")
    @ApiMessage("Get option detail")
    public ResponseEntity<OptionResponseDTO> getOptionDetail(@PathVariable("id") Long id) 
            throws IdInvalidException {
        var optionDTO = optionService.getOptionById(id);
        return ResponseEntity.ok(optionDTO);
    }

    /**
     * Cập nhật tùy chọn
     */
    @PutMapping("/{id}")
    @ApiMessage("Update option")
    public ResponseEntity<OptionUpdateResponseDTO> updateOption(@PathVariable("id") Long id,
            @Valid @RequestBody OptionUpdateRequestDTO request) throws IdInvalidException {
        var updatedDTO = optionService.updateOption(id, request);
        
        // Tạo response DTO riêng cho update
        OptionUpdateResponseDTO response = new OptionUpdateResponseDTO();
        response.setId(updatedDTO.getId());
        response.setQuestionId(updatedDTO.getQuestionId());
        response.setQuestionText(updatedDTO.getQuestionText());
        response.setOptionText(updatedDTO.getOptionText());
        response.setMessage("Cập nhật tùy chọn thành công!");
        response.setCreatedAt(updatedDTO.getCreatedAt());
        response.setUpdatedAt(updatedDTO.getUpdatedAt());
        
        return ResponseEntity.ok(response);
    }

    /**
     * Xóa tùy chọn
     */
    @DeleteMapping("/{id}")
    @ApiMessage("Delete option")
    public ResponseEntity<OptionDeleteResponseDTO> deleteOption(@PathVariable("id") Long id) 
            throws IdInvalidException {
        optionService.deleteOption(id);
        OptionDeleteResponseDTO response = new OptionDeleteResponseDTO(id, "Xóa tùy chọn thành công");
        return ResponseEntity.ok(response);
    }
}