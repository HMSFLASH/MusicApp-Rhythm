package com.music.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import jakarta.validation.constraints.Size;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SetPasswordRequest {
    @Size(max = 254, message = "Login ID must be at most 254 characters")
    private String loginId;

    @Size(min = 12, max = 128, message = "Password must be between 12 and 128 characters")
    private String password;
}
