package vn.duytan.c1se09.smartsurvey.util.dto.auth;

import lombok.Getter;
import lombok.Setter;

/**
 * DTO cho response của authentication
 */
@Getter
@Setter
public class AuthResponse {

    private String token;
    private String type = "Bearer";
    private Long id;
    private String email;
    private String fullName;
    private String role;
    private Boolean isActive;

    public AuthResponse() {
    }

    public AuthResponse(String token, Long userId, String email, String fullName, String role, Boolean isActive) {
        this.token = token;
        this.id = userId;
        this.email = email;
        this.fullName = fullName;
        this.role = role;
        this.isActive = isActive;
    }
}