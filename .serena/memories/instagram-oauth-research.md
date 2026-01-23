# Instagram OAuth Integration - Research & Implementation Plan

## Status: ON HOLD
**Date Researched:** January 2026
**Decision:** Paused due to API limitations (Business/Creator accounts only)

---

## Key Findings

### Critical Limitation
As of **December 4, 2024**, the Instagram Basic Display API was **deprecated**. The replacement API (Instagram API with Instagram Login) **only supports Business and Creator accounts**.

**Personal Instagram accounts can no longer be accessed via any third-party API.**

### Impact on Vara
- Target users (women 18-44) often have personal accounts
- Users would need to convert to Business/Creator account (free but adds friction)
- High-risk profiles (creators, journalists, influencers) likely already have compatible accounts

### Potential Mitigation
- Provide in-app guide to convert Personal → Creator account
- Position feature as "for public content creators"
- Focus marketing on high-risk profiles who benefit most

---

## Technical Specifications

### OAuth Flow

**Authorization URL:**
```
https://api.instagram.com/oauth/authorize
  ?client_id={APP_ID}
  &redirect_uri={CALLBACK_URL}
  &scope=instagram_business_basic
  &response_type=code
  &state={CSRF_TOKEN}
```

**Required Scope:** `instagram_business_basic` (read profile + media)

### Token Exchange

1. **Short-lived token** (1 hour):
   ```
   POST https://api.instagram.com/oauth/access_token
   Body: client_id, client_secret, grant_type=authorization_code, redirect_uri, code
   ```

2. **Long-lived token** (60 days):
   ```
   GET https://graph.instagram.com/access_token
     ?grant_type=ig_exchange_token
     &client_secret={SECRET}
     &access_token={SHORT_LIVED_TOKEN}
   ```

3. **Token refresh** (every 50 days):
   ```
   GET https://graph.instagram.com/refresh_access_token
     ?grant_type=ig_refresh_token
     &access_token={CURRENT_TOKEN}
   ```

### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /me?fields=id,username,name,profile_picture_url,account_type` | User profile |
| `GET /me/media?fields=id,media_type,media_url,permalink,timestamp` | User's photos |
| `GET /{media-id}?fields=children{media_url,media_type}` | Carousel children |

### Rate Limits
- 200 requests/hour per user token
- Max 10,000 media items retrievable per account

---

## App Setup Requirements

### Meta Developer Console
1. Create Facebook Developer App
2. Add Instagram product
3. Configure `instagram_business_basic` permission
4. Register redirect URIs (must be HTTPS)

### App Review (Required for Production)
- Business Verification required (since Feb 2023)
- Screen recording of OAuth flow
- Privacy policy URL
- Data handling documentation
- Review timeline: 5 days to 3 months

---

## Implementation Tasks (When Ready)

### Phase 1: Infrastructure (Parallel)
- [ ] Add env vars: `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET`, `INSTAGRAM_REDIRECT_URI`
- [ ] Create token encryption service (AES-256)
- [ ] Verify ConnectedAccount schema supports Instagram

### Phase 2: Backend Core (Parallel)
- [ ] Create `/api/v1/accounts/instagram/connect` - Initiate OAuth
- [ ] Create `/api/v1/accounts/instagram/callback` - Handle redirect
- [ ] Create `/api/v1/accounts/instagram/disconnect` - Remove connection
- [ ] Create `/api/v1/accounts` - List connected accounts
- [ ] Create Instagram API service (profile fetch, media fetch with pagination)

### Phase 3: Background Processing
- [ ] Create Instagram media import worker (BullMQ)
- [ ] Integrate CLIP embedding generation for imported photos
- [ ] Store imported photos as ProtectedImages
- [ ] Implement progress tracking

### Phase 4: Frontend
- [ ] Create ConnectedAccounts component (connect/disconnect buttons)
- [ ] Create OAuth callback page `/auth/callback/instagram`
- [ ] Create `useConnectedAccounts` TanStack Query hook
- [ ] Add Connected Accounts tab to Settings page
- [ ] Add "Instagram requires Business/Creator account" messaging

### Phase 5: Token Management
- [ ] Create scheduled job to refresh tokens every 50 days
- [ ] Handle refresh failures (notify user to re-authenticate)
- [ ] Implement token revocation on disconnect

### Phase 6: Quality Assurance
- [ ] Security audit (token storage, CSRF, state validation)
- [ ] Unit tests for OAuth flow
- [ ] Integration tests with mocked Instagram API

---

## Environment Variables Needed

```env
# Instagram OAuth (via Facebook/Meta)
INSTAGRAM_CLIENT_ID=
INSTAGRAM_CLIENT_SECRET=
INSTAGRAM_REDIRECT_URI=https://vara-api-yaqq.onrender.com/api/v1/accounts/instagram/callback
```

---

## Security Checklist

- [ ] State parameter for CSRF protection
- [ ] Tokens encrypted with AES-256 before DB storage
- [ ] No tokens in logs or error messages
- [ ] HTTPS-only redirect URIs
- [ ] Validate received scopes match requested

---

## Estimated Effort

| Phase | Agents | Estimated Time |
|-------|--------|----------------|
| Infrastructure | 3 | 5-8 min |
| Backend Core | 2 | 10-15 min |
| Background Processing | 1 | 8-12 min |
| Frontend | 4 | 15-20 min |
| Token Management | 1 | 5-8 min |
| Quality Assurance | 3 | 10-15 min |
| **Total** | **14** | **~60-80 min** |

---

## Resources

- [Instagram Graph API Guide 2025](https://elfsight.com/blog/instagram-graph-api-complete-developer-guide-for-2025/)
- [Instagram API 2026 Developer Guide](https://getlate.dev/blog/instagram-api)
- [Meta Developer Console](https://developers.facebook.com/)
- [Instagram Basic Display API Deprecation Notice](https://docs.spotlightwp.com/article/884-preparing-for-the-end-of-instagram-basic-display-api-what-to-expect-and-how-to-adapt)

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-14 | Paused implementation | Instagram API only supports Business/Creator accounts; need to evaluate if target users have compatible accounts |
