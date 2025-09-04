package vn.duytan.c1se09.smartsurvey.service;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import vn.duytan.c1se09.smartsurvey.domain.User;
import vn.duytan.c1se09.smartsurvey.repository.UserRepository;
import vn.duytan.c1se09.smartsurvey.security.JwtUtils;
import vn.duytan.c1se09.smartsurvey.util.constant.RoleEnum;
import vn.duytan.c1se09.smartsurvey.util.dto.auth.AuthResponse;
import vn.duytan.c1se09.smartsurvey.util.dto.auth.LoginRequest;
import vn.duytan.c1se09.smartsurvey.util.dto.auth.RegisterRequest;

/**
 * Service xử lý logic authentication
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;

    @Transactional
    public AuthResponse registerUser(RegisterRequest registerRequest) {
        // Kiểm tra email tồn tại
        if (userRepository.existsByEmail(registerRequest.getEmail())) {
            throw new RuntimeException("Email đã được sử dụng: " + registerRequest.getEmail());
        }

        // Validate password
        if (!registerRequest.getPassword().equals(registerRequest.getConfirmPassword())) {
            throw new RuntimeException("Mật khẩu xác nhận không khớp");
        }

        // Tạo user mới
        User user = new User();
        user.setEmail(registerRequest.getEmail());
        user.setPasswordHash(passwordEncoder.encode(registerRequest.getPassword()));
        user.setFullName(registerRequest.getFullName());
        user.setRole(RoleEnum.creator); // Mặc định là creator
        user.setIsActive(true);

        // Lưu user
        User savedUser = userRepository.save(user);

        // Tạo authentication
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(registerRequest.getEmail(), registerRequest.getPassword()));

        SecurityContextHolder.getContext().setAuthentication(authentication);

        // Tạo JWT token
        String jwt = jwtUtils.generateJwtToken(authentication);

        // Trả về response
        return new AuthResponse(
                jwt,
                savedUser.getUserId(),
                savedUser.getEmail(),
                savedUser.getFullName(),
                savedUser.getRole().name(),
                savedUser.getIsActive());
    }

    public AuthResponse authenticateUser(LoginRequest loginRequest) {
        // Authentication
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        loginRequest.getEmail(),
                        loginRequest.getPassword()));

        SecurityContextHolder.getContext().setAuthentication(authentication);

        // Lấy user details
        var userDetails = authentication.getPrincipal();
        if (!(userDetails instanceof org.springframework.security.core.userdetails.User)) {
            throw new RuntimeException("Invalid user details");
        }

        var springUser = (org.springframework.security.core.userdetails.User) userDetails;

        // Tìm user trong database
        User user = userRepository.findByEmail(springUser.getUsername())
                .orElseThrow(() -> new RuntimeException("User không tồn tại"));

        // Tạo JWT token
        String jwt = jwtUtils.generateJwtToken(authentication);

        // Trả về response
        return new AuthResponse(
                jwt,
                user.getUserId(),
                user.getEmail(),
                user.getFullName(),
                user.getRole().name(),
                user.getIsActive());
    }

    public User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }

        String email = authentication.getName();
        return userRepository.findByEmail(email).orElse(null);
    }

    public boolean hasRole(RoleEnum role) {
        User currentUser = getCurrentUser();
        return currentUser != null && currentUser.getRole() == role;
    }
}