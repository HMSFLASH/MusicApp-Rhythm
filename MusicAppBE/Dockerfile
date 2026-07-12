# Stage 1: build
# Start with a Maven image that includes JDK 21
FROM maven:3.9.8-amazoncorretto-21 AS build

# Copy source code and pom.xml file to /app folder
WORKDIR /app
COPY pom.xml .
COPY src ./src

# Build source code with maven
RUN mvn package -DskipTests

# Stage 2: create custom JRE
FROM amazoncorretto:21-alpine AS jre-build
RUN apk add --no-cache binutils && jlink \
    --add-modules java.base,java.compiler,java.desktop,java.instrument,java.management,java.naming,java.prefs,java.rmi,java.scripting,java.security.jgss,java.sql,jdk.httpserver,jdk.unsupported,java.net.http,jdk.crypto.ec \
    --strip-debug \
    --no-man-pages \
    --no-header-files \
    --compress zip-9 \
    --output /customjre

# Stage 3: create image
FROM alpine:3
# Set working folder to App and copy complied file from above step
WORKDIR /app
COPY --from=jre-build /customjre /opt/jre
ENV PATH="/opt/jre/bin:${PATH}"
COPY --from=build /app/target/*.jar app.jar

# Command to run the application
EXPOSE 8080
ENTRYPOINT ["java","-jar","app.jar"]
