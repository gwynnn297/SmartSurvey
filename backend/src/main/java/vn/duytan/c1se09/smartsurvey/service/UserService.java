package vn.duytan.c1se09.smartsurvey.service;

import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.duytan.c1se09.smartsurvey.domain.User;
import vn.duytan.c1se09.smartsurvey.domain.request.UserRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.UserResponseDTO;
import vn.duytan.c1se09.smartsurvey.repository.UserRepository;

/**
 * Service xử lý logic quản lý user
 */
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * Tạo user mới
     */
    @Transactional
    public UserResponseDTO createUser(UserRequestDTO dto) {
        // Validate email không trùng
        if (userRepository.existsByEmail(dto.getEmail())) {
            throw new RuntimeException("Email đã được sử dụng: " + dto.getEmail());
        }

        // Tạo user mới
        User user = new User();
        user.setFullName(dto.getFullName());
        user.setEmail(dto.getEmail());
        user.setPasswordHash(passwordEncoder.encode(dto.getPassword())); // Hash password
        user.setRole(dto.getRole());
        user.setIsActive(true);

        // Lưu vào database
        User savedUser = userRepository.save(user);

        // Trả về thông tin user đã tạo (ẩn password)
        return UserResponseDTO.builder()
                .userId(savedUser.getUserId())
                .fullName(savedUser.getFullName())
                .email(savedUser.getEmail())
                .role(savedUser.getRole().name())
                .isActive(savedUser.getIsActive())
                .createdAt(savedUser.getCreatedAt())
                .updatedAt(savedUser.getUpdatedAt())
                .build();
    }

    /**
     * Tìm user theo email (dùng cho JWT authentication)
     */
    public User findUserByEmail(String email) {
        return userRepository.findByEmail(email).orElse(null);
    }

    /**
     * Cập nhật thông tin user hiện tại
     */
    @Transactional
    public User updateUser(User user) {
        return userRepository.save(user);
    }
}
