package vn.duytan.c1se09.smartsurvey.domain.response.option;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class OptionDeleteResponseDTO {
    private Long id;
    private String message;
}