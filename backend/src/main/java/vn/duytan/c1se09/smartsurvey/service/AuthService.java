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
import vn.duytan.c1se09.smartsurvey.domain.response.auth.AuthResponseDTO;
import vn.duytan.c1se09.smartsurvey.repository.UserRepository;
import vn.duytan.c1se09.smartsurvey.security.JwtUtils;
import vn.duytan.c1se09.smartsurvey.util.constant.RoleEnum;
import vn.duytan.c1se09.smartsurvey.domain.request.auth.LoginRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.auth.RegisterRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.auth.ChangePasswordRequestDTO;

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
    public AuthResponseDTO registerUser(RegisterRequestDTO registerRequest) {
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

        // Tạo JWT token với role
        String jwt = jwtUtils.generateJwtToken(authentication, savedUser.getRole().name());

        // Trả về response
        return new AuthResponseDTO(
                jwt,
                savedUser.getUserId(),
                savedUser.getEmail(),
                savedUser.getFullName(),
                savedUser.getRole().name(),
                savedUser.getIsActive());
    }

    public AuthResponseDTO authenticateUser(LoginRequestDTO loginRequest) {
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

        // Kiểm tra isActive
        if (!user.getIsActive()) {
            throw new RuntimeException("Tài khoản của bạn đã bị vô hiệu hóa");
        }

        // Tạo JWT token với role
        String jwt = jwtUtils.generateJwtToken(authentication, user.getRole().name());

        // Trả về response
        return new AuthResponseDTO(
                jwt,
                user.getUserId(),
                user.getEmail(),
                user.getFullName(),
                user.getRole().name(),
                user.getIsActive());
    }

    public User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        System.out.println("=== getCurrentUser called ===");
        System.out.println("Authentication: " + (authentication != null ? authentication.getName() : "null"));
        System.out
                .println("Is authenticated: " + (authentication != null ? authentication.isAuthenticated() : "false"));

        if (authentication == null || !authentication.isAuthenticated()) {
            System.out.println("No authentication found");
            return null;
        }

        String email = authentication.getName();
        System.out.println("Email from authentication: " + email);
        User user = userRepository.findByEmail(email).orElse(null);
        System.out.println("User found: " + (user != null ? user.getEmail() : "null"));
        return user;
    }

    public boolean hasRole(RoleEnum role) {
        User currentUser = getCurrentUser();
        return currentUser != null && currentUser.getRole() == role;
    }

    @Transactional
    public void changePassword(ChangePasswordRequestDTO changePasswordRequest) {
        System.out.println("=== AuthService.changePassword called ===");
        // Lấy user hiện tại
        User currentUser = getCurrentUser();
        System.out.println("Current user: " + (currentUser != null ? currentUser.getEmail() : "null"));
        if (currentUser == null) {
            throw new RuntimeException("Không tìm thấy thông tin user");
        }

        // Kiểm tra mật khẩu hiện tại
        if (!passwordEncoder.matches(changePasswordRequest.getCurrentPassword(), currentUser.getPasswordHash())) {
            throw new RuntimeException("Mật khẩu hiện tại không đúng");
        }

        // Kiểm tra mật khẩu mới và xác nhận
        if (!changePasswordRequest.getNewPassword().equals(changePasswordRequest.getConfirmPassword())) {
            throw new RuntimeException("Mật khẩu mới và xác nhận mật khẩu không khớp");
        }

        // Kiểm tra mật khẩu mới khác mật khẩu hiện tại
        if (passwordEncoder.matches(changePasswordRequest.getNewPassword(), currentUser.getPasswordHash())) {
            throw new RuntimeException("Mật khẩu mới phải khác mật khẩu hiện tại");
        }

        // Cập nhật mật khẩu mới
        currentUser.setPasswordHash(passwordEncoder.encode(changePasswordRequest.getNewPassword()));
        userRepository.save(currentUser);
    }
}