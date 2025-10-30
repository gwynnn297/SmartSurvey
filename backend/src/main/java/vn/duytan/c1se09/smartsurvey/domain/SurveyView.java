package vn.duytan.c1se09.smartsurvey.domain;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Entity để track viewership của survey
 */
@Entity
@Table(name = "survey_views")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SurveyView {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long viewId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "survey_id", nullable = false)
    private Survey survey;
    
    @Column(name = "ip_address", length = 45)
    private String ipAddress;
    
    @Column(name = "user_agent", length = 500)
    private String userAgent;
    
    @Column(name = "session_id", length = 100)
    private String sessionId;
    
    @CreationTimestamp
    @Column(name = "viewed_at", nullable = false, updatable = false)
    private LocalDateTime viewedAt;
    
    @Column(name = "is_unique_view", nullable = false)
    private Boolean isUniqueView = true;
    
    // Constructor để tạo view mới
    public SurveyView(Survey survey, String ipAddress, String userAgent, String sessionId) {
        this.survey = survey;
        this.ipAddress = ipAddress;
        this.userAgent = userAgent;
        this.sessionId = sessionId;
        this.isUniqueView = true;
    }
}
