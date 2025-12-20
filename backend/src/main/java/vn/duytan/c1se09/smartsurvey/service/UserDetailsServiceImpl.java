package vn.duytan.c1se09.smartsurvey.service;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.duytan.c1se09.smartsurvey.domain.User;
import vn.duytan.c1se09.smartsurvey.repository.UserRepository;
import vn.duytan.c1se09.smartsurvey.util.constant.RoleEnum;

import java.util.ArrayList;
import java.util.List;

/**
 * Service để load thông tin user cho Spring Security
 */
@Service
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    public UserDetailsServiceImpl(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    @Transactional
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        System.out.println("=== UserDetailsServiceImpl.loadUserByUsername ===");
        System.out.println("Email: " + email);
        
        // Tìm user theo email và trạng thái active
        // Lưu ý: RoleEnum (role hệ thống - bảng users): admin, creator, respondent
        // SurveyPermissionRole (role trên survey - bảng team_members/survey_permissions): OWNER, EDITOR, ANALYST, VIEWER
        // Chỉ load role từ bảng users (RoleEnum), không liên quan đến team_members
        User user = null;
        try {
            user = userRepository.findByEmailAndIsActive(email, true)
                    .orElseThrow(() -> new UsernameNotFoundException("User Not Found with email: " + email));
            
            System.out.println("User found: " + user.getEmail());
            System.out.println("User role: " + (user.getRole() != null ? user.getRole().name() : "null"));
            System.out.println("User isActive: " + user.getIsActive());
        } catch (Exception e) {
            System.out.println("ERROR loading user: " + e.getMessage());
            System.out.println("Exception type: " + e.getClass().getName());
            e.printStackTrace();
            throw new UsernameNotFoundException("User Not Found with email: " + email, e);
        }

        // Tạo authorities từ role của user (RoleEnum - role hệ thống)
        List<GrantedAuthority> authorities = new ArrayList<>();
        if (user.getRole() != null) {
            // Role từ bảng users (RoleEnum): admin, creator, respondent
            // Spring Security yêu cầu uppercase: ROLE_ADMIN, ROLE_CREATOR, ROLE_RESPONDENT
            String authority = "ROLE_" + user.getRole().name().toUpperCase();
            authorities.add(new SimpleGrantedAuthority(authority));
            System.out.println("Authority created: " + authority);
        } else {
            // Nếu không có role, thêm role mặc định
            authorities.add(new SimpleGrantedAuthority("ROLE_CREATOR"));
            System.out.println("Authority created: ROLE_CREATOR (default)");
        }

        // Trả về UserDetails
        UserDetails userDetails = org.springframework.security.core.userdetails.User.builder()
                .username(user.getEmail())
                .password(user.getPasswordHash())
                .authorities(authorities)
                .accountExpired(false)
                .accountLocked(false)
                .credentialsExpired(false)
                .disabled(!user.getIsActive())
                .build();
        
        System.out.println("UserDetails created successfully for: " + user.getEmail());
        return userDetails;
    }
}