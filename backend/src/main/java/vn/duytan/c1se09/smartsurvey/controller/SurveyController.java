package vn.duytan.c1se09.smartsurvey.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.duytan.c1se09.smartsurvey.domain.Survey;
import vn.duytan.c1se09.smartsurvey.service.SurveyService;
import vn.duytan.c1se09.smartsurvey.util.annotation.ApiMessage;
import vn.duytan.c1se09.smartsurvey.util.constant.SurveyStatusEnum;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * REST Controller cho Survey management
 */
@RestController
@RequestMapping("/api/surveys")
@CrossOrigin(origins = "*", maxAge = 3600)
@RequiredArgsConstructor
public class SurveyController {

    private final SurveyService surveyService;

    @PostMapping
    @ApiMessage("Create a new survey")
    public ResponseEntity<?> createSurvey(@RequestBody Map<String, Object> request) {
        try {
            String title = (String) request.get("title");
            String description = (String) request.get("description");
            Long categoryId = request.get("categoryId") != null ? Long.valueOf(request.get("categoryId").toString())
                    : null;

            if (title == null || title.trim().isEmpty()) {
                throw new RuntimeException("Title is required");
            }

            Survey survey = surveyService.createSurvey(title, description, categoryId);

            Map<String, Object> response = new HashMap<>();
            response.put("surveyId", survey.getSurveyId());
            response.put("title", survey.getTitle());
            response.put("description", survey.getDescription());
            response.put("status", survey.getStatus().name());
            response.put("createdAt", survey.getCreatedAt());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", e.getMessage());
            errorResponse.put("status", "error");
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }

    @GetMapping("/my-surveys")
    @ApiMessage("Get my surveys")
    public ResponseEntity<?> getMySurveys() {
        try {
            List<Survey> surveys = surveyService.getMySurveys();
            return ResponseEntity.ok(surveys);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", e.getMessage());
            errorResponse.put("status", "error");
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }

    @GetMapping("/{surveyId}")
    @ApiMessage("Get a survey")
    public ResponseEntity<?> getSurvey(@PathVariable Long surveyId) {
        try {
            Survey survey = surveyService.getSurveyById(surveyId);
            return ResponseEntity.ok(survey);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", e.getMessage());
            errorResponse.put("status", "error");
            return ResponseEntity.notFound().build();
        }
    }

    @PutMapping("/{surveyId}/status")
    @ApiMessage("Update survey status")
    public ResponseEntity<?> updateSurveyStatus(
            @PathVariable Long surveyId,
            @RequestBody Map<String, String> request) {
        try {
            String statusStr = request.get("status");
            SurveyStatusEnum status = SurveyStatusEnum.valueOf(statusStr);

            Survey survey = surveyService.updateSurveyStatus(surveyId, status);

            Map<String, Object> response = new HashMap<>();
            response.put("surveyId", survey.getSurveyId());
            response.put("status", survey.getStatus().name());
            response.put("updatedAt", survey.getUpdatedAt());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", e.getMessage());
            errorResponse.put("status", "error");
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }

    @DeleteMapping("/{surveyId}")
    @ApiMessage("Delete a survey")
    public ResponseEntity<?> deleteSurvey(@PathVariable Long surveyId) {
        try {
            surveyService.deleteSurvey(surveyId);
            Map<String, String> response = new HashMap<>();
            response.put("message", "Survey deleted successfully");
            response.put("status", "success");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", e.getMessage());
            errorResponse.put("status", "error");
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }

    @GetMapping("/stats")
    @ApiMessage("Get stats")
    public ResponseEntity<?> getStats() {
        try {
            long totalSurveys = surveyService.getTotalSurveys();
            long mySurveys = surveyService.getMyTotalSurveys();

            Map<String, Object> stats = new HashMap<>();
            stats.put("totalSurveys", totalSurveys);
            stats.put("mySurveys", mySurveys);

            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", e.getMessage());
            errorResponse.put("status", "error");
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }
}