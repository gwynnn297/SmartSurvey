# SmartSurvey Backend


```

## How to Build & Run

```sh
./gradlew clean build
java -jar build/libs/smartsurvey-0.0.1-SNAPSHOT.jar
```

## How to Run Tests

```sh
./gradlew test
```

## How to Run with Docker

```sh
docker build -t smartsurvey-backend .
docker run -p 8080:8080 smartsurvey-backend
```

## Notes
- H2 is used for testing, no Docker required for tests.
- For development, configure your database in `application.properties`.
- All migration scripts are in `src/main/resources/db/migration`.
- JWT secret and expiration are configured in `application.properties`.

## Team Guidelines
- Keep code in correct package (controller, service, domain, dto, etc).
- Use DTOs for request/response, avoid exposing entity directly.
- Write unit tests for service and controller logic.
- Update README.md if project structure or setup changes.
