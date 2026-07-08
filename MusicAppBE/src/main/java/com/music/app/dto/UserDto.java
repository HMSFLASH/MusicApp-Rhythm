package com.music.app.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserDto {
    private Long id;
    private String googleId;
    private String username;
    private String email;
    private RoleDto role;
    private String fullName;
    private String avatarUrl;
    @JsonProperty("isGoogleLinked")
    private boolean isGoogleLinked;
    @JsonProperty("hasPassword")
    private boolean hasPassword;
}
