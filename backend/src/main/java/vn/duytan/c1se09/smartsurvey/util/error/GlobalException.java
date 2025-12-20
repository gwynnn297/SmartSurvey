package vn.duytan.c1se09.smartsurvey.util.error;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

import jakarta.servlet.http.HttpServletRequest;
import vn.duytan.c1se09.smartsurvey.domain.response.common.ErrorDTO;
import vn.duytan.c1se09.smartsurvey.util.error.BusinessException;

@RestControllerAdvice
public class GlobalException {
    @ExceptionHandler(value = {
            UsernameNotFoundException.class,
            BadCredentialsException.class,
            IdInvalidException.class,
            DisabledException.class,
            BusinessException.class
    })
    public ResponseEntity<ErrorDTO> handleException(Exception exception, HttpServletRequest request) {
        ErrorDTO body = ErrorDTO.builder()
                .message(exception.getMessage())
                .error("BAD_REQUEST")
                .status(HttpStatus.BAD_REQUEST.value())
                .path(request.getRequestURI())
                .timestamp(LocalDateTime.now())
                .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(value = {
            NoResourceFoundException.class
    })
    public ResponseEntity<ErrorDTO> handleNotFoundException(Exception ex, HttpServletRequest request) {
        ErrorDTO body = ErrorDTO.builder()
                .message(ex.getMessage())
                .error("NOT_FOUND")
                .status(HttpStatus.NOT_FOUND.value())
                .path(request.getRequestURI())
                .timestamp(LocalDateTime.now())
                .build();
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorDTO> validationError(MethodArgumentNotValidException ex, HttpServletRequest request) {
        BindingResult result = ex.getBindingResult();
        final List<FieldError> fieldErrors = result.getFieldErrors();
        List<String> errors = fieldErrors.stream().map(FieldError::getDefaultMessage)
                .collect(Collectors.toUnmodifiableList());
        String message = errors.size() > 1 ? String.join("; ", errors) : errors.get(0);
        ErrorDTO body = ErrorDTO.builder()
                .message(message)
                .error("VALIDATION_ERROR")
                .status(HttpStatus.BAD_REQUEST.value())
                .path(request.getRequestURI())
                .timestamp(LocalDateTime.now())
                .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }
}
