package vn.duytan.c1se09.smartsurvey.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Filter để xử lý JWT token trong mỗi request
 */
@Slf4j
@Component
@RequiredArgsConstructor
@SuppressWarnings("null")
public class AuthTokenFilter extends OncePerRequestFilter {

    private final JwtUtils jwtUtils;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String path = request.getServletPath();
        log.info("Processing request to path: {}", path);

        // Chỉ bỏ qua kiểm tra JWT cho các endpoint public và auth không cần xác thực
        if (path.equals("/auth/login") || path.equals("/auth/register") || path.equals("/auth/forgot-password")
                || path.startsWith("/api/public/") || path.startsWith("/actuator/")) {
            log.info("Skipping JWT validation for public path: {}", path);
            filterChain.doFilter(request, response);
            return;
        }

        try {
            String jwt = parseJwt(request);
            log.info("JWT token found: {}", jwt != null ? "Yes" : "No");
            log.info("Authorization header: {}", request.getHeader("Authorization"));

            if (jwt != null && jwtUtils.validateJwtToken(jwt)) {
                String username = jwtUtils.getUserNameFromJwtToken(jwt);
                String role = jwtUtils.getRoleFromJwtToken(jwt);
                log.info("JWT token valid for user: {} with role: {}", username, role);
                System.out.println("=== AuthTokenFilter: JWT token valid ===");
                System.out.println("Username: " + username);
                System.out.println("Role from token: " + role);
                System.out.println("Path: " + path);

                try {
                    UserDetails userDetails = userDetailsService.loadUserByUsername(username);
                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                            userDetails, null, userDetails.getAuthorities());
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                    SecurityContextHolder.getContext().setAuthentication(authentication);
                    log.info("Authentication set for user: {} with authorities: {}", username, userDetails.getAuthorities());
                    System.out.println("Authentication set successfully for: " + username);
                    System.out.println("Authorities: " + userDetails.getAuthorities());
                } catch (UsernameNotFoundException e) {
                    log.error("User not found: {}", username, e);
                    System.out.println("ERROR: User not found: " + username);
                    e.printStackTrace();
                    // Không set authentication nếu user không tồn tại
                } catch (Exception e) {
                    log.error("Error loading user details for user: {}", username, e);
                    System.out.println("ERROR loading user details for: " + username);
                    System.out.println("Exception: " + e.getMessage());
                    e.printStackTrace();
                    // Không set authentication nếu có lỗi
                }
            } else {
                log.warn("JWT token validation failed for path: {}", path);
                System.out.println("=== AuthTokenFilter: JWT token validation failed ===");
                System.out.println("Path: " + path);
                System.out.println("JWT token: " + (jwt != null ? "exists" : "null"));
            }
        } catch (Exception e) {
            log.error("Cannot set user authentication: {}", e.getMessage(), e);
        }

        filterChain.doFilter(request, response);
    }

    private String parseJwt(HttpServletRequest request) {
        String headerAuth = request.getHeader("Authorization");

        if (StringUtils.hasText(headerAuth) && headerAuth.startsWith("Bearer ")) {
            return headerAuth.substring(7);
        }

        return null;
    }

}
