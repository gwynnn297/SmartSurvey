plugins {
    java
    id("org.springframework.boot") version "3.5.5"
    id("io.spring.dependency-management") version "1.1.7"
    id("io.freefair.lombok") version "8.6"
    // Plugin cho các task Gradle: flywayInfo/flywayMigrate/flywayClean...
    id("org.flywaydb.flyway") version "11.7.2"
}

group = "vn.duytan.c1se09"
version = "0.0.1-SNAPSHOT"
description = "Backend service for SmartSurvey project"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(17)
    }
}

repositories {
    mavenCentral()
}

/* Cấu hình configuration riêng cho các task Flyway của Gradle */
configurations {
    create("flywayMigration")
}

dependencies {
    // Spring Boot
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-thymeleaf")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
    implementation("org.thymeleaf.extras:thymeleaf-extras-springsecurity6")

    implementation("com.turkraft.springfilter:jpa:3.1.7")

    // Flyway chạy lúc ứng dụng start
    implementation("org.flywaydb:flyway-core:11.7.2")
    implementation("org.flywaydb:flyway-mysql:11.7.2")

    // JWT
    implementation("io.jsonwebtoken:jjwt-api:0.11.5")
    runtimeOnly("io.jsonwebtoken:jjwt-impl:0.11.5")
    runtimeOnly("io.jsonwebtoken:jjwt-jackson:0.11.5")

    // Lombok
    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")

    developmentOnly("org.springframework.boot:spring-boot-devtools")

    // MySQL driver cho ứng dụng
    runtimeOnly("com.mysql:mysql-connector-j:9.0.0")

    // Test
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.security:spring-security-test")
    testImplementation("com.h2database:h2")

    // Thư viện cho các task Gradle của Flyway (cần plugin DB + driver)
    add("flywayMigration", "org.flywaydb:flyway-mysql:11.7.2")
    add("flywayMigration", "com.mysql:mysql-connector-j:9.0.0")
}

tasks.withType<Test> {
    useJUnitPlatform()
}

/* Giữ lại tên tham số method để Spring đọc @PathVariable khi build không kèm debug info */
tasks.withType<JavaCompile> {
    if (!options.compilerArgs.contains("-parameters")) {
        options.compilerArgs.add("-parameters")
    }
}

/* Cấu hình cho các task Flyway của Gradle: flywayInfo / flywayMigrate / flywayClean */
flyway {
    // Ưu tiên ENV MYSQL_HOST, rỗng thì dùng localhost
    url = (System.getenv("MYSQL_HOST")?.let { "jdbc:mysql://$it:3306/smartsurvey" }
        ?: "jdbc:mysql://localhost:3306/smartsurvey")
    user = System.getenv("DB_USERNAME") ?: "root"
    password = System.getenv("DB_PASSWORD") ?: ""
    locations = arrayOf("classpath:db/migration") // thư mục migration trong resources
}
