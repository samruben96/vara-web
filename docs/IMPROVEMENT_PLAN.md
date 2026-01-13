# Vara Improvement Plan

**Generated:** 2026-01-12
**Focus:** UX, ease of use, and additional features (excluding image scanning)

---

## Executive Summary

Vara is approximately **60-70% complete** for MVP. The core infrastructure is solid, but several user-facing features need attention:

| Category | Status |
|----------|--------|
| Onboarding | ✅ 90% (missing personalized plan generation) |
| Dashboard | ✅ 85% (needs hero section, personalization) |
| Alerts | ✅ 95% (minor UX polish) |
| Protected Images | ✅ 95% (minor UX polish) |
| **Protection Plan** | ⚠️ 10% (placeholder page, backend complete) |
| **Settings** | ⚠️ 10% (placeholder page) |
| Connected Accounts | ❌ 0% (schema exists, no implementation) |
| Notifications | ❌ 0% (no email service) |

---

## Priority 1: Critical Fixes (Do First)

### 1.1 Fix Broken /scans Route
**Effort:** 15 mins | **Impact:** Critical
- Dashboard "Run Scan" button navigates to `/scans` which doesn't exist
- Fix: Change to navigate to `/images` or trigger scan directly

### 1.2 Fix Alert Count Hardcoded
**Effort:** 10 mins | **Impact:** Medium
- `MainLayout.tsx` line 37: `const alertCount = 3` is hardcoded
- Fix: Connect to real alert count from API

### 1.3 Add /reset-password Route
**Effort:** 30 mins | **Impact:** Critical
- Password reset emails link to `/reset-password` but route doesn't exist
- Create `ResetPassword.tsx` page component

### 1.4 Remove Console.log Statements
**Effort:** 10 mins | **Impact:** Low
- `Signup.tsx` has multiple console.log statements (lines 42, 46, 61, 69, 75, 90)

---

## Priority 2: Quick Wins (< 1 hour each)

### 2.1 Add Success Toast on Auth
**Effort:** 15 mins | **Impact:** High
```typescript
// After successful signup/login
toast.success('Welcome to Vara!', { duration: 2000 });
```

### 2.2 Add Password Visibility Toggle
**Effort:** 30 mins | **Impact:** Medium
- Add eye icon to toggle password visibility on login/signup forms

### 2.3 Improve Empty States
**Effort:** 30 mins | **Impact:** Medium
- Alerts empty state: Add "We're actively monitoring your digital presence"
- Protection Plan: Add encouraging message with CTA

### 2.4 Fix Placeholder Links
**Effort:** 20 mins | **Impact:** Medium
- Replace `href="#"` with actual routes or buttons
- Landing.tsx footer: Privacy Policy, Terms, Contact links

### 2.5 Add Keyboard Accessibility
**Effort:** 45 mins | **Impact:** High
- AlertCard in Dashboard: Add `role="button"`, keyboard handlers
- Alerts expand button: Add `aria-label`, `aria-expanded`

### 2.6 Add Skip Link for Accessibility
**Effort:** 15 mins | **Impact:** Medium
- Add hidden "Skip to main content" link in MainLayout

### 2.7 Add Mobile Login Link
**Effort:** 15 mins | **Impact:** Medium
- Landing page mobile nav only shows "Get Started", no login option

---

## Priority 3: Medium Effort Features (1-4 hours)

### 3.1 Build Protection Plan Page ⭐ CRITICAL
**Effort:** 3-4 hours | **Impact:** Critical

The backend is complete, just needs frontend:
- Checkable task list with progress
- Category organization
- Completion percentage
- Links to relevant actions

```
Files to create:
- apps/web/src/pages/ProtectionPlan.tsx (replace placeholder)
- apps/web/src/components/protection-plan/PlanItem.tsx
- apps/web/src/components/protection-plan/PlanProgress.tsx
```

### 3.2 Build Settings Page ⭐ CRITICAL
**Effort:** 3-4 hours | **Impact:** Critical

Tabs structure:
1. **Profile** - Display name, email (read-only)
2. **Security** - Change password, (2FA placeholder)
3. **Notifications** - Email preferences (placeholder for now)
4. **Privacy** - Data controls
5. **Danger Zone** - Delete account

```
Files to create:
- apps/web/src/pages/Settings.tsx (replace placeholder)
- apps/web/src/components/settings/ProfileSettings.tsx
- apps/web/src/components/settings/SecuritySettings.tsx
- apps/web/src/components/settings/DangerZone.tsx
```

### 3.3 Add Dashboard Protection Status Hero
**Effort:** 2 hours | **Impact:** High

Replace current stats grid with prominent hero:
- Large circular progress showing protection score
- Status label ("Protected", "Needs Attention")
- Last scan timestamp
- Calming visual treatment

### 3.4 Add Alert Detail View
**Effort:** 2-3 hours | **Impact:** High

When clicking an alert, show:
- Full explanation of what was detected
- Step-by-step recommended actions
- Platform-specific report links
- Option to save as evidence

### 3.5 Add Help/Resources Section
**Effort:** 2-3 hours | **Impact:** High

Create `/help` page with:
- FAQs
- Safety resources by topic
- Links to victim advocacy organizations
- Emergency contact information

### 3.6 Personalize Onboarding Results
**Effort:** 2 hours | **Impact:** High

Current: Same 3 generic plan items for everyone
Improvement: Generate 5-8 items based on responses

Map responses to items:
- Image concerns → Image protection tasks
- Harassment history → Platform security tasks
- Relationship concerns → Emergency resources

### 3.7 Add Processing Animation
**Effort:** 1 hour | **Impact:** Medium

After quiz submission, show 2-3 second loading with:
- "Analyzing your responses..."
- "Creating your personalized safety plan..."
- Calming animation

---

## Priority 4: Larger Features (4+ hours)

### 4.1 Email Notification System
**Effort:** 6-8 hours | **Impact:** High

1. Configure email service (SendGrid/Postmark)
2. Add notification preferences to Settings
3. Send emails for:
   - High severity alerts
   - Weekly digest
   - Scan completion

### 4.2 Two-Factor Authentication
**Effort:** 6-8 hours | **Impact:** High

Using Supabase MFA:
- Setup wizard with QR code
- Backup codes
- Device trust option

### 4.3 Connected Accounts (OAuth)
**Effort:** 8-10 hours | **Impact:** High

Start with Instagram only:
- OAuth flow implementation
- Connection status UI
- Sync triggers
- Disconnect option

### 4.4 Data Breach Integration (HIBP)
**Effort:** 4-5 hours | **Impact:** High

- Check email against HIBP API
- Show breach history
- Alert on new breaches
- Guidance for affected services

### 4.5 Emergency Mode
**Effort:** 8-10 hours | **Impact:** High

"I Need Help Now" button that:
- Shows immediate safety resources
- One-click privacy lockdown
- Emergency contacts
- Connect to support

---

## Recommended Sprint Plan

### Week 1: Critical Fixes + Quick Wins
- [ ] Fix /scans route
- [ ] Fix hardcoded alert count
- [ ] Add /reset-password route
- [ ] Add success toasts on auth
- [ ] Fix placeholder links
- [ ] Add keyboard accessibility
- [ ] Remove console.logs

### Week 2: Core Pages
- [ ] Build Protection Plan page (full implementation)
- [ ] Build Settings page (profile, security, danger zone)
- [ ] Add Dashboard Protection Status Hero

### Week 3: User Guidance
- [ ] Build Help/Resources page
- [ ] Add Alert Detail view
- [ ] Personalize onboarding plan generation
- [ ] Add processing animation to onboarding

### Week 4: Communication
- [ ] Set up email service
- [ ] Add notification preferences
- [ ] Implement alert emails
- [ ] Add weekly digest option

---

## Design Philosophy Reminders

From CLAUDE.md, keep in mind:

1. **Emotional Clarity, Not Panic**
   - Use amber/coral for warnings, not red
   - Supportive language, not alarming

2. **Non-Technical Accessibility**
   - Plain language explanations
   - Visual indicators over text

3. **Privacy-First**
   - Clear data controls in Settings
   - Transparent about what we collect

4. **Holistic Protection**
   - Connect features (images → scans → alerts)
   - Show progress and protection status prominently

---

## Files Reference

### Placeholder Pages to Replace
- `apps/web/src/pages/ProtectionPlan.tsx` - 23 lines, "Coming Soon"
- `apps/web/src/pages/Settings.tsx` - 23 lines, "Coming Soon"

### Key Existing Hooks to Use
- `useProtectionPlan()` - Fetches plan items
- `useProtectionPlanMutations()` - Update item status
- `useDashboardStats()` - Aggregated stats
- `useAlerts()` - Paginated alerts

### Backend Already Complete
- `GET /api/v1/protection-plan` - Returns user's plan
- `PATCH /api/v1/protection-plan/items/:id` - Update item status
- `POST /api/v1/protection-plan/regenerate` - Regenerate plan
- `DELETE /api/v1/users/me` - Account deletion with cascade

---

## Metrics to Track

After implementing improvements:

1. **Onboarding Completion Rate** - % completing quiz
2. **Protection Plan Engagement** - % completing plan items
3. **Settings Usage** - % visiting settings
4. **Alert Response Rate** - % of alerts actioned
5. **Return Rate** - % returning after 7 days
