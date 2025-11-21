package vn.duytan.c1se09.smartsurvey.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import vn.duytan.c1se09.smartsurvey.util.constant.SurveyPermissionRole;

import java.time.LocalDateTime;

/**
 * Entity đại diện cho bảng survey_permissions
 * Quản lý permissions cho survey sharing với teams hoặc individual users
 */
@Entity
@Table(name = "survey_permissions")
@Getter
@Setter
public class SurveyPermission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "permission_id")
    private Long permissionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "survey_id", nullable = false)
    private Survey survey;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restricted_team_id")
    private Team restrictedTeam;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "permission", nullable = false)
    private SurveyPermissionRole permission;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "granted_by")
    private User grantedBy;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        validate();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
        validate();
    }

    private void validate() {
        if (user == null) {
            throw new IllegalStateException("User must be set");
        }
        if (restrictedTeam != null && user == null) {
            throw new IllegalStateException("Restricted team can only be used for direct user permissions");
        }
    }
}
