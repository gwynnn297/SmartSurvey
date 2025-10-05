package vn.duytan.c1se09.smartsurvey.controller.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.duytan.c1se09.smartsurvey.dto.ai.HealthCheckResponseDTO;
import vn.duytan.c1se09.smartsurvey.dto.ai.PromptValidationResponseDTO;
import vn.duytan.c1se09.smartsurvey.dto.ai.SurveyGenerationRequestDTO;
import vn.duytan.c1se09.smartsurvey.dto.ai.SurveyGenerationResponseDTO;
import vn.duytan.c1se09.smartsurvey.service.ai.SurveyGeneratorService;

import jakarta.validation.Valid;
import java.security.Principal;
import java.util.Map;

/**
 * Controller cho tạo khảo sát bằng AI
 */
@RestController
@RequestMapping("/ai")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class SurveyGeneratorController {

    private final SurveyGeneratorService surveyGeneratorService;

    /**
     * Tạo khảo sát từ AI prompt
     * 
     * @param request   Yêu cầu tạo khảo sát
     * @param principal User principal from JWT
     * @return Phản hồi khảo sát được tạo
     */
    @PostMapping("/generate-survey")
    public ResponseEntity<SurveyGenerationResponseDTO> generateSurvey(
            @Valid @RequestBody SurveyGenerationRequestDTO request,
            Principal principal) {
        log.info("Đã nhận yêu cầu tạo khảo sát cho prompt: {}",
                request.getAiPrompt().substring(0, Math.min(50, request.getAiPrompt().length())));

        try {
            // Delegate toàn bộ business logic cho service
            SurveyGenerationResponseDTO response = surveyGeneratorService.generateSurvey(request, principal.getName());
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error generating survey: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponseDTO("Lỗi hệ thống khi tạo khảo sát: " + e.getMessage()));
        }
    }

    /**
     * Check AI service health status
     * 
     * @return Health status
     */
    @GetMapping("/health")
    public ResponseEntity<HealthCheckResponseDTO> checkHealth() {
        try {
            boolean isHealthy = surveyGeneratorService.checkAiServiceHealth();

            HealthCheckResponseDTO response = HealthCheckResponseDTO.builder()
                    .status(isHealthy ? "healthy" : "unhealthy")
                    .service("ai-survey-generator")
                    .timestamp(System.currentTimeMillis())
                    .message(isHealthy ? "AI service đang hoạt động bình thường" : "AI service gặp sự cố")
                    .build();

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error checking AI service health: {}", e.getMessage());
            HealthCheckResponseDTO errorResponse = HealthCheckResponseDTO.builder()
                    .status("error")
                    .service("ai-survey-generator")
                    .timestamp(System.currentTimeMillis())
                    .message("Không thể kiểm tra trạng thái AI service: " + e.getMessage())
                    .build();

            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(errorResponse);
        }
    }

    /**
     * Validate prompt before generation
     * 
     * @param prompt Prompt to validate
     * @return Validation result
     */
    @GetMapping("/validate-prompt")
    public ResponseEntity<PromptValidationResponseDTO> validatePrompt(@RequestParam String prompt) {
        try {
            Map<String, Object> validation = surveyGeneratorService.validatePromptOnly(prompt);
            Boolean isValid = (Boolean) validation.get("valid");
            String message = (String) validation.getOrDefault("message", "Kiểm tra hoàn tất");

            return ResponseEntity.ok(PromptValidationResponseDTO.builder()
                    .valid(isValid != null ? isValid : false)
                    .message(message)
                    .timestamp(System.currentTimeMillis())
                    .promptLength(prompt.length())
                    .detectedLanguage("vi") // Assuming Vietnamese
                    .build());

        } catch (Exception e) {
            log.error("Error validating prompt: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(PromptValidationResponseDTO.builder()
                            .valid(false)
                            .message(e.getMessage())
                            .timestamp(System.currentTimeMillis())
                            .promptLength(prompt != null ? prompt.length() : 0)
                            .build());
        }
    }

    /**
     * Create error response DTO for survey generation
     * 
     * @param message Error message
     * @return Error response DTO
     */
    private SurveyGenerationResponseDTO createErrorResponseDTO(String message) {
        return SurveyGenerationResponseDTO.builder()
                .success(false)
                .message(message)
                .build();
    }
}