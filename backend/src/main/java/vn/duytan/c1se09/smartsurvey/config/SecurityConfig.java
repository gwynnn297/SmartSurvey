package vn.duytan.c1se09.smartsurvey.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import vn.duytan.c1se09.smartsurvey.security.AuthEntryPointJwt;
import vn.duytan.c1se09.smartsurvey.security.AuthTokenFilter;
import vn.duytan.c1se09.smartsurvey.service.UserDetailsServiceImpl;

import java.util.Arrays;

/**
 * Cấu hình Spring Security cho ứng dụng
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
@RequiredArgsConstructor
public class SecurityConfig {

    private final UserDetailsServiceImpl userDetailsService;
    private final AuthEntryPointJwt unauthorizedHandler;
    private final AuthTokenFilter authTokenFilter;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(Arrays.asList("http://localhost:3000", "http://localhost:5173"));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList(
                "Authorization",
                "Cache-Control",
                "Content-Type",
                "X-Requested-With",
                "Accept",
                "Origin"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .exceptionHandling(exception -> exception.authenticationEntryPoint(unauthorizedHandler))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authz -> authz
                        // Public endpoints - không cần authentication
                        .requestMatchers("/auth/login", "/auth/register", "/auth/forgot-password").permitAll()
                        .requestMatchers("/api/public/**").permitAll()
                        .requestMatchers("/actuator/**").permitAll()
                        
                        // Auth endpoints - cần authentication
                        .requestMatchers("/auth/change-password", "/auth/me", "/auth/test-token").authenticated()
                        
                        // User endpoints - cần authentication
                        .requestMatchers("/api/users").authenticated()
                        .requestMatchers("/users/profile").authenticated()
                        
                        // Dashboard endpoints - cần authentication
                        .requestMatchers("/dashboard/**").authenticated()
                        
                        // Survey endpoints - cần authentication (bao gồm cả /surveys/{id}/questions)
                        .requestMatchers("/surveys/**").authenticated()
                        
                        // Question endpoints - cần authentication (bao gồm cả /questions/{id}/options)
                        .requestMatchers("/questions/**").authenticated()
                        
                        // Option endpoints - cần authentication
                        .requestMatchers("/options/**").authenticated()
                        
                        // Category endpoints - cần authentication
                        .requestMatchers("/categories/**").authenticated()
                        
                        // Tất cả các request khác - cần authentication
                        .anyRequest().authenticated());

        http.authenticationProvider(authenticationProvider());
        http.addFilterBefore(authTokenFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}