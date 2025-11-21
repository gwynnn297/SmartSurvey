package vn.duytan.c1se09.smartsurvey.service.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import vn.duytan.c1se09.smartsurvey.domain.Category;
import vn.duytan.c1se09.smartsurvey.domain.Survey;
import vn.duytan.c1se09.smartsurvey.domain.User;
import vn.duytan.c1se09.smartsurvey.domain.request.ai.SurveyGenerationRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.ai.SurveyGenerationResponseDTO;
import vn.duytan.c1se09.smartsurvey.service.CategoryService;
import vn.duytan.c1se09.smartsurvey.service.SurveyService;
import vn.duytan.c1se09.smartsurvey.service.UserService;

import java.util.HashMap;
import java.util.Map;

/**
 * Service tổng hợp cho AI Survey Generation
 * Xử lý cả business logic và giao tiếp với AI service
 */
@Service
@RequiredArgsConstructor
@Slf4j
@SuppressWarnings("null")
public class SurveyGeneratorService {

    private final RestTemplate restTemplate;
    private final UserService userService;
    private final CategoryService categoryService;
    private final SurveyService surveyService;

    @Value("${ai.survey-generator.base-url:http://localhost:8002}")
    private String aiServiceBaseUrl;

    @Value("${ai.survey-generator.timeout:30000}")
    private int requestTimeout;

    /**
     * Xử lý toàn bộ logic tạo khảo sát từ AI
     * 
     * @param request  Yêu cầu tạo khảo sát
     * @param username Tên user từ JWT token
     * @return Phản hồi kết quả tạo khảo sát
     * @throws Exception Nếu có lỗi trong quá trình xử lý
     */
    public SurveyGenerationResponseDTO generateSurvey(SurveyGenerationRequestDTO request, String username)
            throws Exception {
        log.info("Bắt đầu xử lý tạo khảo sát AI cho user: {} với prompt: {}",
                username, request.getAiPrompt().substring(0, Math.min(50, request.getAiPrompt().length())));

        // 1. Validate user exists
        User currentUser = validateUser(username);

        // 2. Validate và tìm/tạo category
        Category category = validateOrCreateCategory(request);

        // 3. Kiểm tra AI service health
        validateAiServiceHealth();

        // 4. Validate prompt
        validatePrompt(request.getAiPrompt());

        // 5. Generate survey từ AI
        SurveyGenerationResponseDTO aiResponse = callAiService(request);

        // 6. Save to database
        Survey savedSurvey = saveSurveyToDatabase(currentUser, category, request, aiResponse);

        // 7. Update response với real survey ID
        aiResponse.setSurveyId(savedSurvey.getSurveyId());

        log.info("Hoàn thành tạo khảo sát AI với ID: {} và {} câu hỏi",
                savedSurvey.getSurveyId(),
                aiResponse.getGeneratedSurvey() != null ? aiResponse.getGeneratedSurvey().getQuestions().size() : 0);

        return aiResponse;
    }

    /**
     * Regenerate một câu hỏi đơn lẻ
     */
    public vn.duytan.c1se09.smartsurvey.domain.response.ai.QuestionRegenerateResponseDTO regenerateQuestion(
            vn.duytan.c1se09.smartsurvey.domain.request.ai.QuestionRegenerateRequestDTO request, String username)
            throws Exception {

        log.info("Regenerating question for user: {} with context: {}", username,
                request.getContextHint() != null
                        ? request.getContextHint().substring(0, Math.min(50, request.getContextHint().length()))
                        : "none");

        // 1. Validate user exists
        validateUser(username);

        // 2. Kiểm tra AI service health
        validateAiServiceHealth();

        // 3. Tạo request đơn giản để generate 1 câu hỏi
        vn.duytan.c1se09.smartsurvey.domain.request.ai.SurveyGenerationRequestDTO singleQuestionRequest = new vn.duytan.c1se09.smartsurvey.domain.request.ai.SurveyGenerationRequestDTO();

        singleQuestionRequest.setTitle("Câu hỏi mới");
        singleQuestionRequest.setDescription("Tạo câu hỏi mới");
        singleQuestionRequest.setAiPrompt(request.getOriginalPrompt());
        singleQuestionRequest.setTargetAudience(request.getTargetAudience());
        singleQuestionRequest.setCategoryName(request.getCategoryName());
        singleQuestionRequest.setNumberOfQuestions(1); // Chỉ tạo 1 câu hỏi

        // 4. Gọi AI service
        vn.duytan.c1se09.smartsurvey.domain.response.ai.SurveyGenerationResponseDTO aiResponse = callAiService(
                singleQuestionRequest);

        if (aiResponse == null || !aiResponse.isSuccess() ||
                aiResponse.getGeneratedSurvey() == null ||
                aiResponse.getGeneratedSurvey().getQuestions().isEmpty()) {
            throw new Exception("Không thể tạo câu hỏi từ AI");
        }

        // 5. Lấy câu hỏi đầu tiên
        var generatedQuestion = aiResponse.getGeneratedSurvey().getQuestions().get(0);

        // 6. Map sang DTO response
        var responseBuilder = vn.duytan.c1se09.smartsurvey.domain.response.ai.QuestionRegenerateResponseDTO.builder()
                .success(true)
                .message("Tạo câu hỏi thành công");

        var questionBuilder = vn.duytan.c1se09.smartsurvey.domain.response.ai.QuestionRegenerateResponseDTO.GeneratedQuestionDTO
                .builder()
                .questionText(generatedQuestion.getQuestionText())
                .questionType(generatedQuestion.getQuestionType())
                .isRequired(generatedQuestion.isRequired());

        // 7. Map options nếu có
        if (generatedQuestion.getOptions() != null && !generatedQuestion.getOptions().isEmpty()) {
            var optionDTOs = generatedQuestion.getOptions().stream()
                    .map(opt -> vn.duytan.c1se09.smartsurvey.domain.response.ai.QuestionRegenerateResponseDTO.GeneratedOptionDTO
                            .builder()
                            .optionText(opt.getOptionText())
                            .displayOrder(opt.getDisplayOrder())
                            .build())
                    .toList();
            questionBuilder.options(optionDTOs);
        }

        responseBuilder.question(questionBuilder.build());

        log.info("Successfully regenerated question: {}", generatedQuestion.getQuestionText());

        return responseBuilder.build();
    }

    /**
     * Validate user tồn tại
     */
    private User validateUser(String username) throws Exception {
        User user = userService.findUserByEmail(username);
        if (user == null) {
            log.warn("User not found: {}", username);
            throw new Exception("Người dùng không tồn tại");
        }
        return user;
    }

    /**
     * Validate và tìm/tạo category từ request
     */
    private Category validateOrCreateCategory(SurveyGenerationRequestDTO request) throws Exception {
        // Nếu có categoryId, tìm theo ID
        if (request.getCategoryId() != null) {
            Category category = categoryService.findCategoryById(request.getCategoryId());
            if (category != null) {
                return category;
            }
        }

        // Nếu có categoryName, tìm theo tên hoặc tạo mới
        if (request.getCategoryName() != null && !request.getCategoryName().trim().isEmpty()) {
            String categoryName = request.getCategoryName().trim();

            // Tìm category theo tên (case-insensitive)
            Category existingCategory = categoryService.findCategoryByName(categoryName);
            if (existingCategory != null) {
                return existingCategory;
            }

            // Tạo category mới nếu không tìm thấy
            log.info("Creating new category: {}", categoryName);
            return categoryService.createCategory(categoryName);
        }

        // Nếu không có gì, sử dụng category mặc định (ID = 1)
        Category defaultCategory = categoryService.findCategoryById(1L);
        if (defaultCategory != null) {
            return defaultCategory;
        }

        // Nếu không có category nào, tạo category mặc định
        return categoryService.createCategory("Khảo sát tổng quát");
    }

    /**
     * Kiểm tra AI service health
     */
    private void validateAiServiceHealth() throws Exception {
        if (!isAiServiceHealthy()) {
            log.warn("AI service không hoạt động bình thường");
            throw new Exception("AI service không khả dụng");
        }
    }

    /**
     * Validate prompt hợp lệ
     */
    private void validatePrompt(String prompt) throws Exception {
        Map<String, Object> validation = validatePromptInternal(prompt);
        Boolean isValid = (Boolean) validation.get("valid");

        if (isValid == null || !isValid) {
            String message = (String) validation.getOrDefault("message", "Prompt không hợp lệ");
            log.warn("Invalid prompt: {}", message);
            throw new Exception(message);
        }
    }

    /**
     * Gọi AI service để generate survey
     */
    private SurveyGenerationResponseDTO callAiService(SurveyGenerationRequestDTO request) throws Exception {
        SurveyGenerationResponseDTO aiResponse = callAiServiceGenerate(request);

        if (aiResponse == null || !aiResponse.isSuccess()) {
            log.error("Failed to generate survey from AI service");
            throw new Exception("Không thể tạo khảo sát từ AI");
        }

        return aiResponse;
    }

    // ========== AI SERVICE HTTP METHODS ==========

    /**
     * Gọi AI service để tạo khảo sát
     */
    private SurveyGenerationResponseDTO callAiServiceGenerate(SurveyGenerationRequestDTO request) {
        try {
            log.info("Đang gọi AI service để tạo khảo sát cho prompt: {}",
                    request.getAiPrompt().substring(0, Math.min(50, request.getAiPrompt().length())));

            // Chuẩn bị request payload cho AI service
            Map<String, Object> aiRequest = new HashMap<>();
            aiRequest.put("title", request.getTitle());
            aiRequest.put("description", request.getDescription());

            // Gửi cả category_id và category_name để AI service linh hoạt xử lý
            if (request.getCategoryId() != null) {
            }
            if (request.getCategoryName() != null && !request.getCategoryName().trim().isEmpty()) {
                aiRequest.put("category_name", request.getCategoryName());
            }

            // Fallback: nếu không có category nào, đặt default
            if (request.getCategoryId() == null &&
                    (request.getCategoryName() == null || request.getCategoryName().trim().isEmpty())) {
                aiRequest.put("category_id", 1); // Default category
            }

            aiRequest.put("ai_prompt", request.getAiPrompt());
            aiRequest.put("target_audience", request.getTargetAudience());
            aiRequest.put("number_of_questions", request.getNumberOfQuestions());

            // Thiết lập headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> httpEntity = new HttpEntity<>(aiRequest, headers);

            // Gọi AI service
            String url = aiServiceBaseUrl + "/generate";
            ResponseEntity<SurveyGenerationResponseDTO> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    httpEntity,
                    SurveyGenerationResponseDTO.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                log.info("Đã nhận phản hồi thành công từ AI service");
                SurveyGenerationResponseDTO responseBody = response.getBody();
                if (responseBody != null) {
                    log.info("Response success: {}", responseBody.isSuccess());
                    log.info("Response message: {}", responseBody.getMessage());
                }
                return responseBody;
            } else {
                log.error("AI service trả về status không phải OK: {}", response.getStatusCode());
                return SurveyGenerationResponseDTO.builder()
                        .success(false)
                        .message("AI service không phản hồi đúng định dạng")
                        .build();
            }

        } catch (Exception e) {
            log.error("Lỗi khi gọi AI service: {}", e.getMessage(), e);
            return SurveyGenerationResponseDTO.builder()
                    .success(false)
                    .message("Không thể kết nối đến dịch vụ AI: " + e.getMessage())
                    .build();
        }
    }

    /**
     * Kiểm tra tình trạng AI service
     */
    @SuppressWarnings("rawtypes")
    private boolean isAiServiceHealthy() {
        try {
            String url = aiServiceBaseUrl + "/health";
            ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);
            return response.getStatusCode() == HttpStatus.OK;

        } catch (Exception e) {
            log.warn("Không thể kiểm tra tình trạng AI service: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Validate prompt với AI service
     */
    @SuppressWarnings("rawtypes")
    private Map<String, Object> validatePromptInternal(String prompt) {
        try {
            String url = aiServiceBaseUrl + "/validate-prompt?prompt=" + prompt;
            ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                @SuppressWarnings("unchecked")
                Map<String, Object> result = (Map<String, Object>) response.getBody();
                return result;
            } else {
                Map<String, Object> error = new HashMap<>();
                error.put("valid", false);
                error.put("message", "Không thể validate prompt");
                return error;
            }

        } catch (Exception e) {
            log.warn("Lỗi khi validate prompt: {}", e.getMessage());
            Map<String, Object> error = new HashMap<>();
            error.put("valid", false);
            error.put("message", "Lỗi khi kiểm tra prompt: " + e.getMessage());
            return error;
        }
    }

    /**
     * Lưu survey vào database
     */
    private Survey saveSurveyToDatabase(User user, Category category,
            SurveyGenerationRequestDTO request,
            SurveyGenerationResponseDTO aiResponse) throws Exception {
        try {
            return surveyService.saveAiGeneratedSurvey(user, category, request, aiResponse);
        } catch (Exception e) {
            log.error("Error saving survey to database: {}", e.getMessage(), e);
            throw new Exception("Lỗi khi lưu khảo sát vào database: " + e.getMessage());
        }
    }

    /**
     * Kiểm tra trạng thái AI service
     */
    public boolean checkAiServiceHealth() {
        try {
            return isAiServiceHealthy();
        } catch (Exception e) {
            log.error("Error checking AI service health: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Validate prompt trước khi generate
     */
    public Map<String, Object> validatePromptOnly(String prompt) throws Exception {
        if (prompt == null || prompt.trim().isEmpty()) {
            throw new Exception("Prompt không được để trống");
        }

        return validatePromptInternal(prompt);
    }
}