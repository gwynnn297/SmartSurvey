package vn.duytan.c1se09.smartsurvey.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.duytan.c1se09.smartsurvey.domain.Answer;
import vn.duytan.c1se09.smartsurvey.domain.FileUpload;
import vn.duytan.c1se09.smartsurvey.domain.Response;

import java.util.List;

@Repository
public interface FileUploadRepository extends JpaRepository<FileUpload, Long> {
    List<FileUpload> findByAnswer(Answer answer);

    List<FileUpload> findByAnswerResponse(Response response);
}