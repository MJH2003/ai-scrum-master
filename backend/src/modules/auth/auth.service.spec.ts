import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../../database/prisma.service';

// Mock bcrypt
jest.mock('bcryptjs');

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: 'hashed-password',
    avatar: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    emailVerified: null,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const mockJwtService = {
      signAsync: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          JWT_EXPIRY: '900',
          JWT_REFRESH_EXPIRY: '604800',
          JWT_SECRET: 'test-secret',
          JWT_REFRESH_SECRET: 'test-refresh-secret',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'new@example.com',
      name: 'New User',
      password: 'SecurePass123!',
    };

    it('should register a new user successfully', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      (prismaService.user.create as jest.Mock).mockResolvedValue({
        id: 'new-user-123',
        email: 'new@example.com',
        name: 'New User',
        avatar: null,
        createdAt: new Date(),
      });
      (jwtService.signAsync as jest.Mock)
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      (prismaService.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe('new@example.com');
      expect(prismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'new@example.com',
            name: 'New User',
          }),
        }),
      );
    });

    it('should throw ConflictException if email already exists', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(prismaService.user.create).not.toHaveBeenCalled();
    });

    it('should normalize email to lowercase', async () => {
      const upperCaseEmailDto = {
        ...registerDto,
        email: 'NEW@EXAMPLE.COM',
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      (prismaService.user.create as jest.Mock).mockResolvedValue({
        id: 'new-user-123',
        email: 'new@example.com',
        name: 'New User',
        avatar: null,
        createdAt: new Date(),
      });
      (jwtService.signAsync as jest.Mock).mockResolvedValue('token');
      (prismaService.refreshToken.create as jest.Mock).mockResolvedValue({});

      await service.register(upperCaseEmailDto);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'new@example.com' },
      });
    });

    it('should hash the password with correct salt rounds', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      (prismaService.user.create as jest.Mock).mockResolvedValue({
        id: 'new-user-123',
        email: 'new@example.com',
        name: 'New User',
        avatar: null,
        createdAt: new Date(),
      });
      (jwtService.signAsync as jest.Mock).mockResolvedValue('token');
      (prismaService.refreshToken.create as jest.Mock).mockResolvedValue({});

      await service.register(registerDto);

      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login successfully with valid credentials', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwtService.signAsync as jest.Mock)
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      (prismaService.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe(mockUser.email);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for OAuth user without password', async () => {
      const oauthUser = { ...mockUser, passwordHash: null };
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(oauthUser);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should normalize email to lowercase on login', async () => {
      const upperCaseEmailDto = {
        ...loginDto,
        email: 'TEST@EXAMPLE.COM',
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwtService.signAsync as jest.Mock).mockResolvedValue('token');
      (prismaService.refreshToken.create as jest.Mock).mockResolvedValue({});

      await service.login(upperCaseEmailDto);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });
  });

  describe('refresh', () => {
    it('should refresh tokens successfully', async () => {
      (prismaService.refreshToken.update as jest.Mock).mockResolvedValue({});
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({ email: 'test@example.com' });
      (jwtService.signAsync as jest.Mock)
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');
      (prismaService.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await service.refresh('user-123', 'refresh-token-id');

      expect(result).toHaveProperty('accessToken', 'new-access-token');
      expect(result).toHaveProperty('refreshToken', 'new-refresh-token');
      expect(prismaService.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'refresh-token-id' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      (prismaService.refreshToken.update as jest.Mock).mockResolvedValue({});
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.refresh('non-existent-user', 'refresh-token-id'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should revoke specific refresh token when provided', async () => {
      (prismaService.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await service.logout('user-123', 'specific-refresh-token');

      expect(prismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          token: 'specific-refresh-token',
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should revoke all refresh tokens when no token provided', async () => {
      (prismaService.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

      await service.logout('user-123');

      expect(prismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('logoutAll', () => {
    it('should revoke all refresh tokens for user', async () => {
      (prismaService.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 5 });

      await service.logoutAll('user-123');

      expect(prismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('validateUser', () => {
    it('should return user when found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        avatar: mockUser.avatar,
        createdAt: mockUser.createdAt,
      });

      const result = await service.validateUser('user-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe(mockUser.id);
    });

    it('should return null when user not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.validateUser('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired and revoked tokens', async () => {
      (prismaService.refreshToken.deleteMany as jest.Mock).mockResolvedValue({ count: 10 });

      const result = await service.cleanupExpiredTokens();

      expect(result).toBe(10);
      expect(prismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { expiresAt: { lt: expect.any(Date) } },
            { revokedAt: { not: null } },
          ],
        },
      });
    });
  });
});
