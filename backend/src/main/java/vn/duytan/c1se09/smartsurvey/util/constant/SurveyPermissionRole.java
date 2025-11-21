package vn.duytan.c1se09.smartsurvey.util.constant;

/**
 * Enum cho các role/permission trong survey sharing
 * Tương tự như Google Forms/Typeform
 */
public enum SurveyPermissionRole {
    OWNER("Chủ sở hữu - Toàn quyền kiểm soát"),
    EDITOR("Biên tập viên - Chỉnh sửa khảo sát"),
    ANALYST("Phân tích viên - Chỉ xem kết quả và phân tích"),
    VIEWER("Người xem - Chỉ xem thông tin cơ bản");

    private final String description;

    SurveyPermissionRole(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }

    /**
     * Kiểm tra role có quyền edit survey không
     */
    public boolean canEditSurvey() {
        return this == OWNER || this == EDITOR;
    }

    /**
     * Kiểm tra role có quyền xem results không
     */
    public boolean canViewResults() {
        // Chỉ OWNER và ANALYST được xem kết quả khảo sát
        return this == OWNER || this == ANALYST;
    }

    /**
     * Kiểm tra role có quyền xem survey basic info không
     */
    public boolean canViewSurvey() {
        return true; // Tất cả roles đều có thể xem
    }

    /**
     * Kiểm tra role có quyền delete survey không
     */
    public boolean canDeleteSurvey() {
        return this == OWNER;
    }

    /**
     * Kiểm tra role có quyền manage permissions không
     */
    public boolean canManagePermissions() {
        return this == OWNER;
    }
}

