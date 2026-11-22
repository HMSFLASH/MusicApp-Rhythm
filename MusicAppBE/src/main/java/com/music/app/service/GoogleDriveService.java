package com.music.app.service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

import jakarta.annotation.PostConstruct;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.HttpResponse;
import com.google.api.client.http.InputStreamContent;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.model.File;
import com.google.api.services.drive.model.FileList;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.AccessToken;
import com.google.auth.oauth2.UserCredentials;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class GoogleDriveService {

    private NetHttpTransport httpTransport;
    private final GsonFactory jsonFactory = GsonFactory.getDefaultInstance();

    private Drive getDrive(String refreshToken) {
        UserCredentials credentials = UserCredentials.newBuilder()
                .setClientId(clientId)
                .setClientSecret(clientSecret)
                .setRefreshToken(refreshToken)
                .build();

        com.google.api.client.http.HttpRequestInitializer requestInitializer = new HttpCredentialsAdapter(credentials);
        return new Drive.Builder(httpTransport, jsonFactory, request -> {
                    requestInitializer.initialize(request);
                    request.setConnectTimeout(180000); // 3 minutes
                    request.setReadTimeout(180000); // 3 minutes
                })
                .setApplicationName("MusicApp")
                .build();
    }

    public String getAccessToken(String refreshToken) throws Exception {
        UserCredentials credentials = UserCredentials.newBuilder()
                .setClientId(clientId)
                .setClientSecret(clientSecret)
                .setRefreshToken(refreshToken)
                .build();
        AccessToken accessToken = credentials.refreshAccessToken();
        if (accessToken == null
                || accessToken.getTokenValue() == null
                || accessToken.getTokenValue().isBlank()) {
            throw new IllegalStateException("Google did not return a Drive access token");
        }
        return accessToken.getTokenValue();
    }

    @PostConstruct
    public void init() throws Exception {
        this.httpTransport = GoogleNetHttpTransport.newTrustedTransport();
    }

    @Value("${google.client-id}")
    private String clientId;

    @Value("${google.client-secret}")
    private String clientSecret;

    @Value("${google.drive.folder-name:MusicApp}")
    private String folderName;

    public String getFolderName() {
        return folderName;
    }

    private String escapeDriveQuery(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\\", "\\\\").replace("'", "\\'");
    }

    private String determineMimeType(String fileName) {
        if (fileName == null) return "audio/mpeg";
        String lower = fileName.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".flac")) return "audio/flac";
        if (lower.endsWith(".wav")) return "audio/wav";
        if (lower.endsWith(".ogg")) return "audio/ogg";
        if (lower.endsWith(".opus")) return "audio/ogg";
        if (lower.endsWith(".m4a")) return "audio/mp4";
        if (lower.endsWith(".aac")) return "audio/aac";
        if (lower.endsWith(".wma")) return "audio/x-ms-wma";
        return "audio/mpeg"; // default MP3
    }

    private boolean isAudioFile(File file) {
        if (file == null) {
            return false;
        }
        String mimeType = file.getMimeType();
        if (mimeType != null && mimeType.startsWith("audio/")) {
            return true;
        }
        String name = file.getName();
        if (name == null) {
            return false;
        }
        String lower = name.toLowerCase(Locale.ROOT);
        return lower.endsWith(".mp3")
                || lower.endsWith(".m4a")
                || lower.endsWith(".flac")
                || lower.endsWith(".wav")
                || lower.endsWith(".ogg")
                || lower.endsWith(".opus")
                || lower.endsWith(".aac")
                || lower.endsWith(".wma");
    }

    private String getOrCreateFolder(Drive drive) throws Exception {
        FileList result = drive.files()
                .list()
                .setQ("mimeType='application/vnd.google-apps.folder' and name='"
                        + escapeDriveQuery(folderName)
                        + "' and trashed=false")
                .setSpaces("drive")
                .setFields("files(id, name)")
                .execute();

        List<File> files = result.getFiles();
        if (files != null && !files.isEmpty()) {
            return files.get(0).getId();
        }

        File folderMetadata = new File();
        folderMetadata.setName(folderName);
        folderMetadata.setMimeType("application/vnd.google-apps.folder");

        File folder = drive.files().create(folderMetadata).setFields("id").execute();

        return folder.getId();
    }

    public String uploadAudioStream(InputStream stream, long contentLength, String refreshToken, String fileName)
            throws Exception {
        Drive drive = getDrive(refreshToken);

        File fileMetadata = new File();
        String folderId = getOrCreateFolder(drive);
        fileMetadata.setParents(Collections.singletonList(folderId));

        // Lấy tên file gốc (nếu đường dẫn Telegram có chứa thư mục thì chỉ lấy tên file)
        if (fileName != null && fileName.contains("/")) {
            fileMetadata.setName(fileName.substring(fileName.lastIndexOf("/") + 1));
        } else {
            fileMetadata.setName(fileName);
        }

        String mimeType = determineMimeType(fileName);

        log.info("Creating Drive upload request: fileName={}, mimeType={}, size={}", fileName, mimeType, contentLength);

        InputStreamContent mediaContent = new InputStreamContent(mimeType, stream);
        mediaContent.setLength(contentLength);

        Drive.Files.Create createRequest =
                drive.files().create(fileMetadata, mediaContent).setFields("id");

        // Progress logs intentionally omit the file name and identifier.
        createRequest.getMediaHttpUploader().setDirectUploadEnabled(false).setProgressListener(uploader -> {
            com.google.api.client.googleapis.media.MediaHttpUploader.UploadState state = uploader.getUploadState();
            if (state == com.google.api.client.googleapis.media.MediaHttpUploader.UploadState.INITIATION_STARTED) {
                log.info("Drive upload initiation started");
            } else if (state
                    == com.google.api.client.googleapis.media.MediaHttpUploader.UploadState.INITIATION_COMPLETE) {
                log.info("Drive upload initiation complete");
            } else if (state
                    == com.google.api.client.googleapis.media.MediaHttpUploader.UploadState.MEDIA_IN_PROGRESS) {
                log.info("Drive upload progress: {}", String.format("%.1f%%", uploader.getProgress() * 100));
            } else if (state == com.google.api.client.googleapis.media.MediaHttpUploader.UploadState.MEDIA_COMPLETE) {
                log.info("Drive upload complete");
            } else if (state == com.google.api.client.googleapis.media.MediaHttpUploader.UploadState.NOT_STARTED) {
                log.info("Drive upload not started");
            }
        });

        log.info("Executing Drive upload...");
        File file = createRequest.execute();
        log.info("Drive upload finished, fileId={}", file.getId());

        return file.getId();
    }

    public List<File> listFiles(String refreshToken) throws Exception {
        Drive drive = getDrive(refreshToken);

        String folderId = getOrCreateFolder(drive);
        String query = "'"
                + escapeDriveQuery(folderId)
                + "' in parents and trashed=false and mimeType != 'application/vnd.google-apps.folder'";

        List<File> audioFiles = new ArrayList<>();
        String pageToken = null;
        do {
            FileList result = drive.files()
                    .list()
                    .setQ(query)
                    .setSpaces("drive")
                    .setPageSize(1000)
                    .setPageToken(pageToken)
                    .setFields("nextPageToken, files(id, name, size, mimeType)")
                    .execute();

            List<File> files = result.getFiles();
            if (files != null) {
                for (File file : files) {
                    if (isAudioFile(file)) {
                        audioFiles.add(file);
                    }
                }
            }
            pageToken = result.getNextPageToken();
        } while (pageToken != null && !pageToken.isBlank());

        return audioFiles;
    }

    public File getFileMetadata(String fileId, String refreshToken) throws Exception {
        Drive drive = getDrive(refreshToken);
        return drive.files()
                .get(fileId)
                .setFields("id, name, mimeType, trashed")
                .execute();
    }

    public void deleteFile(String fileId, String refreshToken) throws Exception {
        Drive drive = getDrive(refreshToken);
        try {
            drive.files().delete(fileId).execute();
            log.info("Deleted file {} from Drive", fileId);
        } catch (Exception e) {
            log.error("Failed to delete file {} from Drive", fileId, e);
            throw e;
        }
    }

    public com.music.app.dto.DriveStreamResponse streamFile(String fileId, String rangeHeader, String refreshToken)
            throws Exception {
        Drive drive = getDrive(refreshToken);

        Drive.Files.Get getRequest = drive.files().get(fileId);

        if (rangeHeader != null && !rangeHeader.isEmpty()) {
            getRequest.getRequestHeaders().setRange(rangeHeader);
        }

        HttpResponse driveResponse = getRequest.executeMedia();

        return com.music.app.dto.DriveStreamResponse.builder()
                .inputStream(driveResponse.getContent())
                .statusCode(driveResponse.getStatusCode())
                .contentType(driveResponse.getContentType())
                .contentLength(driveResponse.getHeaders().getContentLength())
                .contentRange(driveResponse.getHeaders().getContentRange())
                .build();
    }

    public void uploadJsonFile(String jsonData, String fileName, String refreshToken) throws Exception {
        Drive drive = getDrive(refreshToken);

        String folderId = getOrCreateFolder(drive);

        // Check if file exists
        FileList result = drive.files()
                .list()
                .setQ("'"
                        + escapeDriveQuery(folderId)
                        + "' in parents and name='"
                        + escapeDriveQuery(fileName)
                        + "' and trashed=false")
                .setSpaces("drive")
                .setFields("files(id)")
                .execute();

        List<File> files = result.getFiles();

        InputStreamContent mediaContent = new InputStreamContent(
                "application/json", new ByteArrayInputStream(jsonData.getBytes(StandardCharsets.UTF_8)));

        if (files != null && !files.isEmpty()) {
            // Update existing
            String existingFileId = files.get(0).getId();
            drive.files().update(existingFileId, null, mediaContent).execute();
        } else {
            // Create new
            File fileMetadata = new File();
            fileMetadata.setName(fileName);
            fileMetadata.setParents(Collections.singletonList(folderId));
            drive.files().create(fileMetadata, mediaContent).setFields("id").execute();
        }
    }

    public String downloadJsonFile(String fileName, String refreshToken) throws Exception {
        Drive drive = getDrive(refreshToken);

        String folderId = getOrCreateFolder(drive);

        FileList result = drive.files()
                .list()
                .setQ("'"
                        + escapeDriveQuery(folderId)
                        + "' in parents and name='"
                        + escapeDriveQuery(fileName)
                        + "' and trashed=false")
                .setSpaces("drive")
                .setFields("files(id)")
                .execute();

        List<File> files = result.getFiles();
        if (files == null || files.isEmpty()) {
            return null; // No backup found
        }

        String fileId = files.get(0).getId();

        try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            drive.files().get(fileId).executeMediaAndDownloadTo(outputStream);
            return new String(outputStream.toByteArray(), StandardCharsets.UTF_8);
        }
    }
}
