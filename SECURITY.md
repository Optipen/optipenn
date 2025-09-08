# JWT Cookie Security Hardening for Production

This document outlines the security improvements implemented for JWT cookies in production environments.

## Security Improvements Implemented

### 1. Environment-Aware Cookie Security

**SameSite Policy:**
- **Development**: `SameSite=Lax` - Allows some cross-site requests for better development experience
- **Production**: `SameSite=Strict` - Blocks all cross-site requests for maximum CSRF protection

**Secure Flag:**
- **Development**: Not set (allows HTTP for local development)
- **Production**: Set (requires HTTPS)

### 2. Token Expiration Hardening

**JWT Token Lifetime:**
- **Development**: 7 days (for developer convenience)
- **Production**: 2 hours (reduced exposure window)

### 3. Security Headers

Added comprehensive security headers for production:
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME type sniffing
- `X-XSS-Protection: 1; mode=block` - Enables XSS protection
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer information
- `Content-Security-Policy: default-src 'self'` - Basic CSP protection

### 4. Environment Validation

**Production Requirements:**
- `JWT_SECRET` environment variable must be set
- Validation occurs at login to ensure security requirements are met

### 5. Cookie Configuration

**Main JWT Cookie (`crm_token`):**
- `HttpOnly: true` - Prevents XSS access
- Dynamic `SameSite` and `Secure` based on environment
- Shorter expiration in production

**CSRF Token Cookie (`csrf_token`):**
- `HttpOnly: false` - JavaScript needs access for CSRF protection
- Same security flags as JWT cookie
- Used for double-submit cookie pattern

## Implementation Details

The security configuration is implemented using dynamic functions that check `process.env.NODE_ENV` at runtime:

```typescript
function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function getCookieBaseOptions() {
  const prodMode = isProduction();
  return { 
    httpOnly: true, 
    sameSite: (prodMode ? "strict" : "lax") as "strict" | "lax", 
    path: "/",
    secure: prodMode
  } as const;
}
```

## Testing

Comprehensive tests validate:
- Cookie security attributes in both environments
- Token expiration behavior
- Proper cookie clearing on logout
- Security headers presence in production

## Security Benefits

1. **CSRF Protection**: Strict SameSite policy in production
2. **Reduced Token Exposure**: Shorter token lifetime in production
3. **Transport Security**: HTTPS-only cookies in production
4. **XSS Mitigation**: HttpOnly flags prevent client-side access
5. **Comprehensive Defense**: Multiple security headers working together

This implementation follows security best practices while maintaining developer experience in development environments.