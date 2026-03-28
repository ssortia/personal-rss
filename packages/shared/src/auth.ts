import { z } from 'zod';

export const RoleSchema = z.enum(['USER', 'ADMIN']);
export type Role = z.infer<typeof RoleSchema>;

export const LoginDtoSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type LoginDto = z.infer<typeof LoginDtoSchema>;

export const RegisterDtoSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type RegisterDto = z.infer<typeof RegisterDtoSchema>;

export const TokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export type Tokens = z.infer<typeof TokensSchema>;

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: RoleSchema,
  telegramUsername: z.string().nullable().optional(),
  telegramChatId: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const TelegramLinkResponseSchema = z.object({
  url: z.string().url(),
  expiresAt: z.coerce.date(),
});
export type TelegramLinkResponse = z.infer<typeof TelegramLinkResponseSchema>;

export type User = z.infer<typeof UserSchema>;

export const UpdateRoleDtoSchema = z.object({ role: RoleSchema });
export type UpdateRoleDto = z.infer<typeof UpdateRoleDtoSchema>;

export const RefreshTokenDtoSchema = z.object({
  refreshToken: z.string(),
});

export type RefreshTokenDto = z.infer<typeof RefreshTokenDtoSchema>;

export const ForgotPasswordDtoSchema = z.object({
  email: z.string().email(),
});

export type ForgotPasswordDto = z.infer<typeof ForgotPasswordDtoSchema>;

export const ResetPasswordDtoSchema = z.object({
  email: z.string().email(),
  token: z.string(),
  password: z.string().min(8),
});

export type ResetPasswordDto = z.infer<typeof ResetPasswordDtoSchema>;

export const OAuthLoginDtoSchema = z.object({
  provider: z.string(),
  providerAccountId: z.string(),
  email: z.string().email(),
});

export type OAuthLoginDto = z.infer<typeof OAuthLoginDtoSchema>;
