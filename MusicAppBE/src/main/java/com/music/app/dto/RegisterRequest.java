package com.music.app.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import lombok.Data;

@Data
public class RegisterRequest {
    @NotBlank(message = "Username is required")
    @Size(max = 100, message = "Username must be at most 100 characters")
    private String username;

    @NotBlank(message = "Password is required")
    @Size(min = 12, max = 128, message = "Password must be between 12 and 128 characters")
    private String password;

    @NotBlank(message = "Email is required")
    @Email(message = "Email should be valid")
    @Size(max = 254, message = "Email must be at most 254 characters")
    private String email;
}
