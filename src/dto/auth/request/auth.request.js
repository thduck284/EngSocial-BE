import { BaseDTO } from '../../base.dto.js'

/**
 * Register Request DTO
 * Input: email, password, name
 */
export class RegisterRequestDTO extends BaseDTO {
  constructor(body) {
    super({
      email: body.email?.toLowerCase()?.trim(),
      password: body.password,
      name: body.name?.trim(),
    })
  }
}

/**
 * Login Request DTO
 * Input: email, password
 */
export class LoginRequestDTO extends BaseDTO {
  constructor(body) {
    super({
      email: body.email?.toLowerCase()?.trim(),
      password: body.password,
    })
  }
}

/**
 * Refresh Token Request DTO
 * Input: refreshToken
 */
export class RefreshTokenRequestDTO extends BaseDTO {
  constructor(body) {
    super({
      refreshToken: body.refreshToken,
    })
  }
}

/**
 * Change Password Request DTO
 */
export class ChangePasswordRequestDTO extends BaseDTO {
  constructor(body) {
    super({
      oldPassword: body.oldPassword,
      newPassword: body.newPassword,
    })
  }
}

/**
 * Forgot Password Request DTO
 */
export class ForgotPasswordRequestDTO extends BaseDTO {
  constructor(body) {
    super({
      email: body.email?.toLowerCase()?.trim(),
    })
  }
}

/**
 * Reset Password Request DTO
 */
export class ResetPasswordRequestDTO extends BaseDTO {
  constructor(body) {
    super({
      token: body.token,
      newPassword: body.newPassword,
    })
  }
}
