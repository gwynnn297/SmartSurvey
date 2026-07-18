# Multi-stage build để giảm image size
FROM eclipse-temurin:17-jdk-alpine AS builder

WORKDIR /app

# Copy Gradle wrapper & build files trước (cache layer)
COPY gradlew .
COPY gradle gradle
COPY build.gradle.kts settings.gradle.kts ./

# Fix line endings cho gradlew trên Linux
RUN sed -i 's/\r//' gradlew && chmod +x gradlew

# Download dependencies (cached nếu build files không thay đổi)
RUN ./gradlew dependencies --no-daemon -q

# Copy source code
COPY src ./src

# Build (skip tests để nhanh hơn)
RUN ./gradlew bootJar --no-daemon -x test

# ---- Stage 2: Runtime ----
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Copy jar từ builder stage
COPY --from=builder /app/build/libs/*.jar app.jar

# Tạo thư mục uploads
RUN mkdir -p /app/uploads

EXPOSE 8080

# JVM tuning cho container
ENTRYPOINT ["java", \
    "-Xmx512m", \
    "-Xms256m", \
    "-XX:+UseContainerSupport", \
    "-XX:MaxRAMPercentage=75.0", \
    "-jar", "app.jar"]
