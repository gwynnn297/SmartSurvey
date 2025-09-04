package vn.duytan.c1se09.smartsurvey.util.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

//hỗ trợ trang trí lấy giá trị ApiMessage thông báo truyền vào phía controller
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface ApiMessage {
    String value();
}
