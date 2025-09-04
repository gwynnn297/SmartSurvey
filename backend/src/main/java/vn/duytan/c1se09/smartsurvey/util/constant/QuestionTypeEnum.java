package vn.duytan.c1se09.smartsurvey.util.constant;

public enum QuestionTypeEnum {
    multiple_choice("Trắc nghiệm nhiều lựa chọn"),
    open_ended("Câu hỏi mở"),
    rating("Đánh giá"),
    boolean_("Đúng/Sai");

    private final String description;

    QuestionTypeEnum(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}