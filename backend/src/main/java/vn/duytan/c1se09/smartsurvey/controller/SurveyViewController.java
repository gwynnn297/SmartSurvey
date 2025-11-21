package vn.duytan.c1se09.smartsurvey.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.duytan.c1se09.smartsurvey.domain.SurveyView;
import vn.duytan.c1se09.smartsurvey.service.SurveyViewService;
import vn.duytan.c1se09.smartsurvey.util.annotation.ApiMessage;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;

import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;

/**
 * Controller xử lý việc track viewership của survey
 */
@RestController
@RequestMapping("/api/surveys")
@RequiredArgsConstructor
public class SurveyViewController {
    
    private final SurveyViewService surveyViewService;
    
    /**
     * Track view khi người dùng xem survey form
     * POST /api/surveys/{surveyId}/track-view
     */
    @PostMapping("/{surveyId}/track-view")
    @ApiMessage("Track survey view")
    public ResponseEntity<Map<String, Object>> trackView(
            @PathVariable Long surveyId,
            HttpServletRequest request) {
        try {
            // Lấy IP address từ request
            String ipAddress = getClientIpAddress(request);
            
            // Lấy User-Agent từ request
            String userAgent = request.getHeader("User-Agent");
            if (userAgent == null) {
                userAgent = "Unknown";
            }
            
            // Track view
            SurveyView view = surveyViewService.trackView(surveyId, ipAddress, userAgent);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "View tracked successfully");
            response.put("viewId", view.getViewId());
            response.put("surveyId", surveyId);
            response.put("viewedAt", view.getViewedAt());
            
            return ResponseEntity.ok(response);
            
        } catch (IdInvalidException e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse);
        } catch (Exception e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Error tracking view: " + e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }
    
    /**
     * Lấy thống kê viewership của survey
     * GET /api/surveys/{surveyId}/viewership
     * Permission check được thực hiện trong SurveyViewService
     */
    @GetMapping("/{surveyId}/viewership")
    @ApiMessage("Get survey viewership statistics")
    public ResponseEntity<Map<String, Object>> getViewershipStats(@PathVariable Long surveyId) throws IdInvalidException {
        try {
            long totalViews = surveyViewService.getTotalViews(surveyId);
            long uniqueViews = surveyViewService.getUniqueViews(surveyId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("surveyId", surveyId);
            response.put("totalViews", totalViews);
            response.put("uniqueViews", uniqueViews);
            response.put("message", "Viewership statistics retrieved successfully");
            
            return ResponseEntity.ok(response);
            
        } catch (IdInvalidException e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse);
        } catch (Exception e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Error getting viewership stats: " + e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }
    
    /**
     * Lấy IP address thực của client (xử lý proxy/load balancer)
     */
    private String getClientIpAddress(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty() && !"unknown".equalsIgnoreCase(xForwardedFor)) {
            return xForwardedFor.split(",")[0].trim();
        }
        
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty() && !"unknown".equalsIgnoreCase(xRealIp)) {
            return xRealIp;
        }
        
        return request.getRemoteAddr();
    }
}
