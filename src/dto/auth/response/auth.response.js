import { BaseDTO } from '../../base.dto.js'
import { UserDTO } from './user.response.js'

/**
 * Auth Response DTO
 */
export class AuthResponseDTO extends BaseDTO {
  constructor({ user, accessToken, refreshToken }) {
    super({
      user: new UserDTO(user),
      accessToken,
      refreshToken,
    })
  }
}

/**
 * Login Response DTO
 */
export class LoginResponseDTO extends AuthResponseDTO {}

/**
 * Register Response DTO
 */
export class RegisterResponseDTO extends AuthResponseDTO {}

/**
 * Refresh Token Response DTO
 */
export class RefreshTokenResponseDTO extends BaseDTO {
  constructor({ accessToken }) {
    super({ accessToken })
  }
}
