package vn.duytan.c1se09.smartsurvey.domain.response.question;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class QuestionDeleteResponseDTO {
    private Long id;
    private String message;
} 