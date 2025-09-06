package vn.duytan.c1se09.smartsurvey.util.constant;

public enum RoleEnum {
    admin("Quản trị viên hệ thống"),
    creator("Người tạo khảo sát"),
    respondent("Người trả lời khảo sát");

    private final String description;

    RoleEnum(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}