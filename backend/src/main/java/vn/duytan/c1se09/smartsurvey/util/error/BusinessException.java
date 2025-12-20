package vn.duytan.c1se09.smartsurvey.util.error;

/**
 * Exception cho các lỗi business logic - thường trả về 400 BAD_REQUEST
 */
public class BusinessException extends RuntimeException {
    public BusinessException(String message) {
        super(message);
    }
    
    public BusinessException(String message, Throwable cause) {
        super(message, cause);
    }
}

