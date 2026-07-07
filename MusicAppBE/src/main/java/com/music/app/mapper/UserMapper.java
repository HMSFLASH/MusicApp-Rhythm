package com.music.app.mapper;

import com.music.app.dto.UserDto;
import com.music.app.model.User;
import org.mapstruct.Mapper;
import org.mapstruct.factory.Mappers;

@Mapper(componentModel = "spring")
public interface UserMapper {
    UserMapper INSTANCE = Mappers.getMapper(UserMapper.class);

    UserDto toDto(User user);
    @org.mapstruct.Mapping(target = "password", ignore = true)
    @org.mapstruct.Mapping(target = "refreshToken", ignore = true)
    User toEntity(UserDto userDto);
}
