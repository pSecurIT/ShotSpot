# Navigation Role Visibility Matrix

This document describes which navigation items are visible for each role.

Roles:
- **user**: regular authenticated user
- **coach**: coach permissions (includes user-level features)
- **admin**: administrator permissions (includes coach + user features)

## Top-Level Navigation

| Section | user | coach | admin |
|---|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ |
| Matches | ✅ | ✅ | ✅ |
| Analytics | ✅ | ✅ | ✅ |
| Data | ✅ | ✅ | ✅ |
| Settings | ❌ | ✅ | ✅ |

## Section Details

### Matches
- All Games: user/coach/admin
- Live Match: user/coach/admin
- Match Templates: coach/admin

### Analytics
- Match Analytics: user/coach/admin
- Achievements: user/coach/admin
- Advanced Analytics: coach/admin (currently disabled)
- Team Analytics: coach/admin (currently disabled)

### Data
- Players: user/coach/admin
- Teams: user/coach/admin
- Clubs: coach/admin (currently disabled)
- Competitions: coach/admin (currently disabled)
- Series/Divisions: coach/admin (currently disabled)

### Settings
- Export Center: coach/admin
- Report Templates: coach/admin (currently disabled)
- Scheduled Reports: coach/admin (currently disabled)
- Export Settings: coach/admin (currently disabled)
- Twizzit Integration: coach/admin
- User Management: admin only

## Visual Indicators

- Admin-only items are rendered with an **Admin** badge in navigation menus.
