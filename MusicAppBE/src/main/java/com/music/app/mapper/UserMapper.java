package com.music.app.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.factory.Mappers;

import com.music.app.dto.UserDto;
import com.music.app.model.User;

@Mapper(componentModel = "spring")
public interface UserMapper {
    UserMapper INSTANCE = Mappers.getMapper(UserMapper.class);

    @Mapping(
            target = "isGoogleLinked",
            expression = "java(user.getGoogleId() != null && !user.getGoogleId().isEmpty())")
    @Mapping(target = "hasPassword", expression = "java(user.getPassword() != null && !user.getPassword().isEmpty())")
    UserDto toDto(User user);

    @Mapping(target = "password", ignore = true)
    @Mapping(target = "refreshToken", ignore = true)
    @Mapping(target = "authTokenVersion", ignore = true)
    User toEntity(UserDto userDto);
}
