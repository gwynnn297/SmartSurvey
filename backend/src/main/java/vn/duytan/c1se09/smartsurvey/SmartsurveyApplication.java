package vn.duytan.c1se09.smartsurvey;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication
@EnableJpaRepositories(basePackages = "vn.duytan.c1se09.smartsurvey.repository")
public class SmartsurveyApplication {

	public static void main(String[] args) {
		SpringApplication.run(SmartsurveyApplication.class, args);
	}
}