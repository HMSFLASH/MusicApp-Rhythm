package com.music.app.model;

import java.time.LocalDateTime;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.*;

@Entity
@Table(name = "invalidated_tokens")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InvalidatedToken {
    @Id
    private String id;

    private LocalDateTime expiryTime;
}
