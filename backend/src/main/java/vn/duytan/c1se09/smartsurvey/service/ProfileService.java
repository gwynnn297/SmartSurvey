package vn.duytan.c1se09.smartsurvey.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.duytan.c1se09.smartsurvey.domain.User;
import vn.duytan.c1se09.smartsurvey.domain.request.profile.UpdateProfileRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.profile.ProfileResponseDTO;
import vn.duytan.c1se09.smartsurvey.repository.UserRepository;

/**
 * Service xử lý logic profile management
 */
@Service
@RequiredArgsConstructor
public class ProfileService {

    private final UserRepository userRepository;
    private final AuthService authService;

    /**
     * Lấy thông tin profile của user hiện tại
     */
    public ProfileResponseDTO getCurrentUserProfile() {
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new RuntimeException("Không tìm thấy thông tin user");
        }

        return ProfileResponseDTO.builder()
                .userId(currentUser.getUserId())
                .fullName(currentUser.getFullName())
                .email(currentUser.getEmail())
                .role(currentUser.getRole().name())
                .createdAt(currentUser.getCreatedAt())
                .updatedAt(currentUser.getUpdatedAt())
                .build();
    }

    /**
     * Cập nhật profile của user hiện tại
     */
    @Transactional
    public ProfileResponseDTO updateProfile(UpdateProfileRequestDTO updateRequest) {
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new RuntimeException("Không tìm thấy thông tin user");
        }

        // Cập nhật full name
        currentUser.setFullName(updateRequest.getFullName());

        // Lưu user
        User savedUser = userRepository.save(currentUser);

        // Trả về profile đã cập nhật
        return ProfileResponseDTO.builder()
                .userId(savedUser.getUserId())
                .fullName(savedUser.getFullName())
                .email(savedUser.getEmail())
                .role(savedUser.getRole().name())
                .createdAt(savedUser.getCreatedAt())
                .updatedAt(savedUser.getUpdatedAt())
                .build();
    }
}
