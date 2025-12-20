package vn.duytan.c1se09.smartsurvey.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Entity đại diện cho bảng user_profiles
 * Lưu trữ thông tin profile của user (gender, age_band, region)
 */
@Entity
@Table(name = "user_profiles")
@Getter
@Setter
public class UserProfile {
    
    @Id
    @Column(name = "user_id")
    private Long userId;
    
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    @MapsId
    private User user;
    
    @Column(name = "gender", columnDefinition = "ENUM('male', 'female', 'other', 'prefer_not_to_say')")
    private String gender;
    
    @Column(name = "age_band", columnDefinition = "ENUM('18-24', '25-34', '35-44', '45-54', '55-64', '65+', 'prefer_not_to_say')")
    private String ageBand;
    
    @Column(name = "region")
    private String region;
    
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}



