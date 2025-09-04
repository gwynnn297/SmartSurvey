package vn.duytan.c1se09.smartsurvey.util.constant;

public enum SurveyStatusEnum {
    draft("Bản nháp"),
    published("Đã xuất bản"),
    archived("Đã lưu trữ");

    private final String description;

    SurveyStatusEnum(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}