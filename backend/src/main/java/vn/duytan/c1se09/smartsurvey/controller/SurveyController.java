package vn.duytan.c1se09.smartsurvey.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import vn.duytan.c1se09.smartsurvey.util.annotation.ApiMessage;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;
import vn.duytan.c1se09.smartsurvey.domain.response.survey.SurveyResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.survey.SurveyDetailResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.survey.SurveyDeleteResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.survey.SurveyPaginationDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.survey.SurveyPublicResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.survey.SurveyStatusResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.survey.SurveyCreateRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.survey.SurveyUpdateRequestDTO;
import vn.duytan.c1se09.smartsurvey.service.SurveyService;

import jakarta.validation.Valid;

/**
 * REST Controller cho Survey management
 */
@RestController
@RequestMapping("/surveys")
@RequiredArgsConstructor
public class SurveyController {
    private final SurveyService surveyService;

    // Endpoint hợp nhất: luôn trả về danh sách phân trang
    @GetMapping
    @ApiMessage("Get surveys list (paginated)")
    public ResponseEntity<SurveyPaginationDTO> getSurveys(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "10") int size) throws IdInvalidException {
        return ResponseEntity.ok(surveyService.getMySurveysPaginated(page, size));
    }

    /**
     * Tạo khảo sát mới
     */
    @PostMapping
    @ApiMessage("Create new survey")
    public ResponseEntity<SurveyResponseDTO> createSurvey(@Valid @RequestBody SurveyCreateRequestDTO request)
            throws IdInvalidException {
        var surveyDTO = surveyService.createSurvey(request);
        // Activity log đã được ghi trong SurveyService.createSurvey()
        return ResponseEntity.ok(surveyDTO);
    }

    /**
     * Lấy chi tiết khảo sát theo id (kèm questions và options)
     */
    @GetMapping("/{id}")
    @ApiMessage("Get survey detail with questions and options")
    public ResponseEntity<SurveyDetailResponseDTO> getSurveyDetail(@PathVariable("id") Long id)
            throws IdInvalidException {
        var surveyDetailDTO = surveyService.getSurveyByIdWithDetails(id);
        return ResponseEntity.ok(surveyDetailDTO);
    }

    /**
     * Cập nhật khảo sát
     */
    @PutMapping("/{id}")
    @ApiMessage("Update survey")
    public ResponseEntity<SurveyResponseDTO> updateSurvey(@PathVariable("id") Long id,
            @RequestBody SurveyUpdateRequestDTO request) throws IdInvalidException {
        var updatedDTO = surveyService.updateSurvey(id, request);
        // Activity log đã được ghi trong SurveyService.updateSurvey()
        return ResponseEntity.ok(updatedDTO);
    }

    /**
     * Xóa khảo sát
     */
    @DeleteMapping("/{id}")
    @ApiMessage("Delete survey")
    public ResponseEntity<SurveyDeleteResponseDTO> deleteSurvey(@PathVariable("id") Long id) throws IdInvalidException {
        surveyService.deleteSurvey(id);
        SurveyDeleteResponseDTO response = new SurveyDeleteResponseDTO(id, "Xóa khảo sát thành công");
        // Activity log đã được ghi trong SurveyService.deleteSurvey()
        return ResponseEntity.ok(response);
    }

    /**
     * API 1: Get Survey Public - Lấy thông tin survey để người dùng trả lời (không cần authentication)
     * Endpoint: GET /surveys/{id}/public
     */
    @GetMapping("/{id}/public")
    @ApiMessage("Get survey public information for response")
    public ResponseEntity<?> getSurveyPublic(@PathVariable("id") Long id) {
        try {
            SurveyPublicResponseDTO surveyPublic = surveyService.getSurveyPublic(id);
            return ResponseEntity.ok(surveyPublic);
        } catch (IdInvalidException e) {
            SurveyStatusResponseDTO errorResponse = SurveyStatusResponseDTO.builder()
                .surveyId(id)
                .status("not_found")
                .message("Survey not found or not available")
                .build();
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorResponse);
        }
    }
    
    /**
     * API 2: Check Survey Status - Kiểm tra survey có active và có thể trả lời không
     * Endpoint: GET /surveys/{id}/status
     */
    @GetMapping("/{id}/status")
    @ApiMessage("Check survey status for response availability")
    public ResponseEntity<SurveyStatusResponseDTO> checkSurveyStatus(@PathVariable("id") Long id) {
        SurveyStatusResponseDTO statusResponse = surveyService.checkSurveyStatus(id);
        
        // Trả về HTTP status code phù hợp với status
        switch (statusResponse.getStatus()) {
            case "active":
                return ResponseEntity.ok(statusResponse);
            case "closed":
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(statusResponse);
            case "not_found":
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(statusResponse);
            default:
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(statusResponse);
        }
    }

}
