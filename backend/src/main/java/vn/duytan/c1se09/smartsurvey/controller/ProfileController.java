package vn.duytan.c1se09.smartsurvey.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

import vn.duytan.c1se09.smartsurvey.domain.request.profile.UpdateProfileRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.profile.ProfileResponseDTO;
import vn.duytan.c1se09.smartsurvey.service.ProfileService;
import vn.duytan.c1se09.smartsurvey.util.annotation.ApiMessage;

import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.Map;

/**
 * REST Controller cho Profile management
 */
@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileService profileService;

    @GetMapping("/profile")
    @ApiMessage("Get user profile")
    public ResponseEntity<?> getProfile() {
        try {
            ProfileResponseDTO profile = profileService.getCurrentUserProfile();
            return ResponseEntity.ok(profile);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", "Lỗi khi lấy thông tin profile: " + e.getMessage());
            errorResponse.put("status", "error");
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }

    @PutMapping("/profile")
    @ApiMessage("Update user profile")
    public ResponseEntity<?> updateProfile(@Valid @RequestBody UpdateProfileRequestDTO updateRequest,
            BindingResult bindingResult) {
        // Bắt lỗi validation
        if (bindingResult.hasErrors()) {
            String errorMessage = bindingResult.getAllErrors().get(0).getDefaultMessage();
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", errorMessage);
            errorResponse.put("status", "error");
            return ResponseEntity.badRequest().body(errorResponse);
        }

        try {
            ProfileResponseDTO updatedProfile = profileService.updateProfile(updateRequest);
            return ResponseEntity.ok(updatedProfile);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", "Lỗi khi cập nhật profile: " + e.getMessage());
            errorResponse.put("status", "error");
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }
}
