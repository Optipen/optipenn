# Security Documentation

This document outlines the security improvements implemented for authentication and brute-force protection.

## 1. JWT Cookie Security Hardening for Production

### Environment-Aware Cookie Security

**SameSite Policy:**
- **Development**: `SameSite=Lax` - Allows some cross-site requests for better development experience
- **Production**: `SameSite=Strict` - Blocks all cross-site requests for maximum CSRF protection

**Secure Flag:**
- **Development**: Not set (allows HTTP for local development)
- **Production**: Set (requires HTTPS)

### Token Expiration Hardening

**JWT Token Lifetime:**
- **Development**: 7 days (for developer convenience)
- **Production**: 2 hours (reduced exposure window)

### Security Headers

Added comprehensive security headers for production:
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME type sniffing
- `X-XSS-Protection: 1; mode=block` - Enables XSS protection
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer information
- `Content-Security-Policy: default-src 'self'` - Basic CSP protection

## 2. Brute-Force Protection

### Rate Limiting Implementation

**Login Endpoint Protection:**
- **15-minute window**: Maximum 10 failed login attempts per IP
- **1-hour window**: Maximum 20 total login attempts per IP (includes successful ones)
- **Progressive restrictions**: Multiple rate limiters for layered protection

**Registration Endpoint Protection:**
- **15-minute window**: Maximum 10 registration attempts per IP
- **Prevents account creation spam** and automated attacks

### Rate Limiting Configuration

```typescript
// Enhanced login rate limiter
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  skipSuccessfulRequests: true, // Only count failed attempts
  message: { message: "Trop de tentatives de connexion. Réessayez dans 15 minutes." }
});

// Strict hourly rate limiter
const strictLoginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Maximum 20 attempts per hour
  skipSuccessfulRequests: true
});

// Registration rate limiter
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 registration attempts
  skipSuccessfulRequests: false // Count all registration attempts
});
```

### Security Logging

**Authentication Monitoring:**
- All login attempts are logged with IP addresses
- Failed login attempts generate security warnings
- Registration attempts are tracked
- Centralized logging for security analysis

**Log Examples:**
```
[AUTH] Successful login for user: user@example.com from IP: 192.168.1.100
[SECURITY] Failed login attempt for email: user@example.com from IP: 192.168.1.100
[SECURITY] Login attempt for non-existent email: fake@example.com from IP: 192.168.1.100
[SECURITY] Registration attempt for existing email: user@example.com from IP: 192.168.1.100
```

### Error Messages

**French Language Support:**
- All rate limiting messages are in French
- User-friendly error messages that indicate timing
- Consistent messaging across endpoints

## 3. Implementation Details

### Cookie Configuration

**Main JWT Cookie (`crm_token`):**
- `HttpOnly: true` - Prevents XSS access
- Dynamic `SameSite` and `Secure` based on environment
- Shorter expiration in production

**CSRF Token Cookie (`csrf_token`):**
- `HttpOnly: false` - JavaScript needs access for CSRF protection
- Same security flags as JWT cookie
- Used for double-submit cookie pattern

### Environment Validation

**Production Requirements:**
- `JWT_SECRET` environment variable must be set
- Validation occurs at login to ensure security requirements are met

## 4. Testing

### Comprehensive Test Coverage

**Cookie Security Tests:**
- Cookie security attributes in both environments
- Token expiration behavior
- Proper cookie clearing on logout
- Security headers presence in production

**Brute-Force Protection Tests:**
- Rate limiting on login attempts
- Rate limiting on registration attempts
- Progressive rate limiting behavior
- Error message validation
- Rate limit headers verification

### Test Examples

```typescript
// Test excessive login attempts
it('limits excessive login attempts from same IP', async () => {
  // Make multiple failed login attempts
  // Verify initial 401 responses, then 429 rate limit responses
  // Validate French error messages
});

// Test registration rate limiting
it('limits excessive registration attempts from same IP', async () => {
  // Make multiple registration attempts
  // Verify rate limiting eventually kicks in
});
```

## 5. Security Benefits

### Authentication Security
1. **CSRF Protection**: Strict SameSite policy in production
2. **Reduced Token Exposure**: Shorter token lifetime in production
3. **Transport Security**: HTTPS-only cookies in production
4. **XSS Mitigation**: HttpOnly flags prevent client-side access

### Brute-Force Protection
1. **Rate Limiting**: Multiple layers of rate limiting prevent automated attacks
2. **IP-based Protection**: Limits are applied per IP address
3. **Progressive Restrictions**: Multiple time windows provide layered defense
4. **Audit Trail**: Comprehensive logging for security monitoring
5. **User Experience**: Legitimate users can continue after brief delays

### Monitoring and Response
1. **Real-time Logging**: All authentication events are logged with IP addresses
2. **Security Alerts**: Failed attempts generate security warnings
3. **Rate Limit Headers**: Standard rate limiting headers for client awareness
4. **French Localization**: All security messages are in French for better UX

This implementation follows security best practices while maintaining usability and providing comprehensive protection against both credential-based and brute-force attacks.