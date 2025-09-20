package vn.duytan.c1se09.smartsurvey.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.duytan.c1se09.smartsurvey.domain.ActivityLog;
import vn.duytan.c1se09.smartsurvey.domain.User;
import vn.duytan.c1se09.smartsurvey.repository.ActivityLogRepository;

@Service
@RequiredArgsConstructor
public class ActivityLogService {
    private final ActivityLogRepository activityLogRepository;
    private final AuthService authService;

    @Transactional
    public void log(ActivityLog.ActionType actionType, Long targetId, String targetTable, String description) {
        User current = authService.getCurrentUser();
        ActivityLog log = new ActivityLog();
        log.setUser(current);
        log.setActionType(actionType);
        log.setTargetId(targetId);
        log.setTargetTable(targetTable);
        log.setDescription(description);
        activityLogRepository.save(log);
    }
}
