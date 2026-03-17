# Real-Time UX Spec — E-CLAT

> **Author:** Kima (Frontend Dev)  
> **Date:** 2026-03-20  
> **Status:** Design Specification (Pre-Implementation)  
> **Issue:** #111 (W-40 to W-43 Real-Time Screens)  
> **Related Decision:** Decision 9 (Event-Driven + WebSocket)  
> **Applies To:** `apps/web`, real-time connections, notifications, presence, nudges  
> **Companion Docs:** `docs/specs/feature-flags-spec.md`, `docs/specs/event-contracts.md`

---

## Executive Summary

E-CLAT needs **real-time synchronization** to keep users informed of changes, show who's online, and enable instant communication. This spec defines the **WebSocket client integration** and real-time UX components that enable:

- **Presence indicators** (online/offline/busy dots) on user avatars, team rosters, and notifications
- **Notification center** with persistent list + toast notifications for assignments, approvals, escalations
- **Nudge workflow** where supervisors send instant nudges to employees (with action button to complete task)
- **Connection status indicator** showing WebSocket health + graceful degradation if offline
- **Feature flag context** to conditionally enable/disable real-time features per tenant
- **Graceful fallback** to polling when WebSocket unavailable (degraded mode)

All real-time features use `@microsoft/signalr` (or raw WebSocket fallback) with React hooks and context for state management, ensuring the app remains responsive even when real-time is disabled.

---

## 1. User Stories

### 1.1 As an Employee

I want to **see which supervisors/managers are online** so that I know who's available to help me with compliance questions.

**Acceptance Criteria:**
- Presence indicators on user avatars/list items: green dot = online, gray dot = offline, yellow dot = busy (optional)
- Indicator updates in real-time as users log in/out
- Hover indicator → tooltip showing "Online", "Offline", or "Last seen 2 hours ago"
- Presence synced across all pages (my section, team directory, chat/messaging if implemented)
- Works in team roster, supervisor list on dashboard, in modal user selectors
- Graceful fallback: if WebSocket down, indicators not shown (not red X or "error")

### 1.2 As an Employee

I want to **see a notification feed** of assignments, approvals, deadlines, and reminders so that I don't miss compliance deadlines.

**Acceptance Criteria:**
- Notification center icon in header (bell icon with badge count)
- Click icon → drawer/panel opens showing:
  - List of notifications (most recent first)
  - Each notification shows: message, timestamp, action button (if applicable), read status
  - Notification types: template assigned, deadline reminder (30/60/90 days), approval requested, escalation notice
- Notifications grouped by type or date
- "Mark as read" button on each notification or "Mark all as read" at top
- Persistent list persists across page navigation
- Separate: Toast notifications appear at bottom-right for urgent notifications (deadline today, escalation)
- Settings icon in notification center → link to preference page (which notifications to show)

### 1.3 As a Supervisor

I want to **send a nudge** to an employee who hasn't completed a pending assignment so that I can urge them without sending an email.

**Acceptance Criteria:**
- Nudge button on Employee Detail page or Assignment list (visible only if assignment pending + deadline approaching)
- Click nudge → modal: "Send Nudge to Alice about CPR Certification?"
- Optional message field: "Please complete your CPR certification by next Friday"
- Submit → sends nudge + creates notification on employee's device
- Employee receives notification: "Supervisor nudged you: Complete CPR Certification by [deadline]"
- Action button on notification: "Go to Assignment" → jumps employee to template fulfillment page
- Supervisor sees confirmation: "✓ Nudge sent to Alice"
- Nudge history viewable in audit log (who sent, when, to whom)

### 1.4 As an Employee

I want to **see connection status** so that I know whether real-time updates are working or if the app is in degraded mode.

**Acceptance Criteria:**
- Small indicator in header (next to user menu) showing connection status
- Connected: Green dot + "Live" text (optional)
- Connecting: Yellow dot + "Reconnecting..." spinner
- Disconnected: Gray dot + "Offline mode" text
- Tooltip on hover: "Real-time updates disabled. Using cached data. (Retry)"
- Click indicator → manual retry or navigate to settings
- When disconnected, app falls back to polling every 30s (polling flag controls behavior)
- No error messages; graceful degradation

### 1.5 As a Compliance Officer

I want to **receive real-time alerts** when assignments are escalated or when compliance status changes so that I can act immediately.

**Acceptance Criteria:**
- Alert toast appears immediately when escalation threshold met (e.g., "3 employees past deadline")
- Alert notification persists in notification center until acknowledged
- Alert includes: what happened, who/what affected, recommended action
- Links in notification: jump to affected employee, template, or dashboard view
- Alert preference settings (frequency, types, quiet hours)
- Do not disturb mode: disable toasts but keep persistent notifications

---

## 2. Page & Component Hierarchy

### 2.1 Real-Time Component Tree

```
App
├── WebSocketProvider (manages connection, auto-reconnect, message dispatching)
│   ├── FeatureFlagContext (gates real-time features)
│   ├── PresenceProvider (tracks who's online)
│   ├── NotificationProvider (manages notification state + delivery)
│   ├── ConnectionStatusIndicator (header, shows WebSocket health)
│   │
│   └── Layout
│       ├── Header
│       │   ├── PresenceIndicators (dots on avatars)
│       │   ├── NotificationBell (icon + badge count)
│       │   └── ConnectionStatusIndicator
│       │
│       ├── NotificationCenter (persistent drawer/modal on bell click)
│       ├── ToastContainer (for urgent toasts)
│       │
│       └── [All Pages]
│           ├── Team Directory (with presence dots)
│           ├── Employee Detail (with nudge button)
│           ├── Assignment list (with nudge buttons)
│           └── Dashboard (real-time metric updates)
```

### 2.2 Reusable Components

```
WebSocketProvider
├── useWebSocket() hook (connection state, send, subscribe)
├── usePresence() hook (online users)
├── useNotifications() hook (notification list, mark read, delete)
└── Auto-reconnect logic (exponential backoff)

PresenceIndicator (Avatar Dot)
├── Status: online, offline, busy
├── Color + icon + tooltip
└── Optional: last-seen timestamp

NotificationCenter
├── Header (title + close + preferences)
├── NotificationList
│   ├── Notification cards (message, timestamp, action button, read status)
│   ├── Grouping (by type or date)
│   ├── Mark as read / Mark all as read
│   └── Delete notification
├── Empty state (no notifications)
└── Footer (settings link, clear all)

NotificationToast
├── Icon (info, warning, error, success)
├── Message
├── Action button (optional)
└── Auto-dismiss (5s) or persistent

NudgeModal
├── Title: "Send Nudge to [Employee]"
├── Employee detail (name, assignment, deadline)
├── Message field (optional)
├── Send button
└── Confirmation

ConnectionStatusIndicator
├── Dot (green/yellow/gray)
├── Text (Connected/Reconnecting/Offline)
├── Tooltip with details
└── Retry button (if disconnected)
```

---

## 3. Wireframe Descriptions (Text-Based)

### 3.1 Header with Real-Time Components

```
┌──────────────────────────────────────────────────────────┐
│ E-CLAT Logo    [ Dashboard | Team | ... ]   ⊗ ● Alice v │
│                                          (connection)    │
│                                          (notification)  │
└──────────────────────────────────────────────────────────┘

⊗ = Connection indicator
    Green dot + "Live"     (connected)
    Yellow dot + spinner   (reconnecting)
    Gray dot + "Offline"   (disconnected)

⚫ = Notification bell
    Circle badge with number (e.g., "3" unread notifications)
    Click → opens notification center drawer
```

### 3.2 Notification Center Drawer

```
Trigger: Click bell icon in header

Drawer (slides in from right or opens as modal):
┌──────────────────────────────────────────────┐
│ Notifications                  × [Settings]  │
├──────────────────────────────────────────────┤
│                                              │
│ [☐ Mark all as read] [Clear All]            │
│                                              │
│ TODAY                                        │
│ ┌──────────────────────────────────────────┐ │
│ │ 🔔 Template Assigned                     │ │
│ │ CPR Certification assigned to you        │ │
│ │ Deadline: 2026-12-31  [ Go to Template ]│ │
│ │ 2:15 PM                              [✓] │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ ⚠ Deadline Reminder                      │ │
│ │ Your CPR Certification expires in 7 days│ │
│ │ [ Complete Now ]  2:10 PM            [✓] │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ YESTERDAY                                    │
│ ┌──────────────────────────────────────────┐ │
│ │ ✓ Assignment Fulfilled                   │ │
│ │ Your manager approved your submission    │ │
│ │ [ View Approval ]  Yesterday          [✓] │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ (No more notifications)                      │
│                                              │
│ [ Notification Settings ]  [ Load More ]    │
└──────────────────────────────────────────────┘
```

### 3.3 Toast Notifications

```
Bottom-right corner (or top-right on mobile):

┌─────────────────────────────────────────┐
│ ⚠ 3 Employees Past Deadline              │
│ Finance dept has 3 overdue assignments   │
│ [ View Dashboard ]           [ Dismiss ] │
└─────────────────────────────────────────┘

OR (info toast):

┌─────────────────────────────────────────┐
│ 🔔 You've been nudged!                   │
│ Your supervisor sent: Complete CPR cert!│
│ [ Go to Assignment ]     Auto-dismiss in 3s
└─────────────────────────────────────────┘
```

### 3.4 Presence Indicators on Team Roster

```
Team Directory:

┌────────────────────────────────┐
│ Team Directory                 │
├────────────────────────────────┤
│ [●] Alice Johnson    Manager   │
│     alice@company.com          │
│     Online now                 │
│                                │
│ [●] Bob Smith        Supervisor│
│     bob@company.com            │
│     Online now                 │
│                                │
│ [○] Carol Davis      Employee  │
│     carol@company.com          │
│     Offline (seen 2 hours ago) │
│                                │
│ [◐] David Brown      Employee  │
│     david@company.com          │
│     Busy / In meeting          │
└────────────────────────────────┘

● = Green dot (online)
○ = Gray dot (offline)
◐ = Yellow dot (busy)
```

### 3.5 Nudge Modal

```
Modal on Employee Detail page:

┌──────────────────────────────────────────┐
│ Send Nudge                             × │
├──────────────────────────────────────────┤
│                                          │
│ Employee: Alice Johnson                  │
│ Assignment: CPR Certification            │
│ Status: Pending (deadline in 5 days)    │
│                                          │
│ Your message (optional):                 │
│ [________________________________]       │
│ [________________________________]       │
│                                          │
│ [ Send Nudge ]  [ Cancel ]               │
│                                          │
│ Note: Alice will receive a notification  │
│ with a button to complete the task.     │
└──────────────────────────────────────────┘

On Send:
✓ Nudge sent to Alice Johnson.
(Toast, dismisses after 3s)
```

### 3.6 Connection Status Indicator

```
Header (right side):

Connected:
┌──────────────────┐
│ ● Live           │
└──────────────────┘
Hover: "Connected to E-CLAT. Real-time updates enabled."

Reconnecting:
┌──────────────────┐
│ ◐ Reconnecting...│
│  (spinner)       │
└──────────────────┘
Hover: "Attempting to reconnect. Using cached data."

Disconnected:
┌──────────────────┐
│ ○ Offline Mode   │
│ [ Retry ]        │
└──────────────────┘
Hover: "Real-time updates unavailable. Using cached data. Click retry to reconnect."
```

---

## 4. State Management Approach

### 4.1 WebSocket Context

```typescript
// src/contexts/WebSocketContext.ts
interface WebSocketContextValue {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  error?: string;
  reconnectAttempts: number;

  // Methods
  send: (message: RealTimeMessage) => void;
  subscribe: (channel: string, handler: (data: any) => void) => () => void;
  unsubscribe: (channel: string, handler: (data: any) => void) => void;

  // Presence
  onlineUsers: string[]; // user IDs
  userPresence: Map<string, PresenceStatus>; // user ID -> status

  // Notifications
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (notificationId: string) => void;
}

export const useWebSocket = (): WebSocketContextValue => {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error('useWebSocket called outside WebSocketProvider');
  return ctx;
};

// Presence hook
export const usePresence = (userId: string): PresenceStatus => {
  const { userPresence } = useWebSocket();
  return userPresence.get(userId) ?? 'offline';
};

// Notifications hook
export const useNotifications = () => {
  const { notifications, unreadCount, markAsRead, deleteNotification } = useWebSocket();
  return { notifications, unreadCount, markAsRead, deleteNotification };
};
```

### 4.2 Real-Time Message Schema

```typescript
// Inbound messages from server (WebSocket push)
interface RealTimeMessage {
  type: 'presence' | 'notification' | 'assignment-update' | 'escalation' | 'nudge';
  data: Record<string, any>;
  timestamp: string;
}

// Presence message
interface PresenceMessage extends RealTimeMessage {
  type: 'presence';
  data: {
    userId: string;
    status: 'online' | 'offline' | 'busy';
    lastSeen?: string;
  };
}

// Notification message
interface NotificationMessage extends RealTimeMessage {
  type: 'notification';
  data: {
    id: string;
    type: 'template_assigned' | 'deadline_reminder' | 'approval' | 'escalation' | 'nudge';
    recipientId: string;
    title: string;
    message: string;
    actionUrl?: string;
    actionLabel?: string;
  };
}

// Nudge message (special notification)
interface NudgeMessage extends RealTimeMessage {
  type: 'nudge';
  data: {
    notificationId: string;
    fromUserId: string;
    fromUserName: string;
    assignmentId: string;
    templateName: string;
    optionalMessage?: string;
  };
}
```

### 4.3 Graceful Degradation

```typescript
// src/hooks/useRealtimeFeature.ts
interface RealtimeFeatureState {
  isEnabled: boolean;
  isConnected: boolean;
  fallbackPollInterval: number; // ms
  // If not connected, poll API instead
  // If feature flag off, don't attempt WebSocket
}

const useRealtimeFeature = (featureName: string): RealtimeFeatureState => {
  const { flags } = useFeatureFlags();
  const { isConnected } = useWebSocket();

  const enabled = flags[`web.realtime-${featureName}`] ?? true; // default on
  const connected = enabled && isConnected;

  return {
    isEnabled: enabled,
    isConnected: connected,
    fallbackPollInterval: connected ? 0 : 30000, // poll every 30s if offline
  };
};
```

---

## 5. API Integration Points

### 5.1 WebSocket / SignalR Connection

```
Connection: wss://api.company.com/ws
Auth: JWT in header (Authorization: Bearer <token>)

Hub: PresenceHub
  Methods:
    - SubscribePresence() → start receiving presence updates
    - GetOnlineUsers() → fetch list of online users on connect

Hub: NotificationHub
  Methods:
    - SubscribeNotifications() → start receiving notifications
    - MarkNotificationRead(notificationId) → send acknowledgment
    - DeleteNotification(notificationId) → delete from inbox

Hub: NudgeHub
  Methods:
    - SendNudge(assignmentId, recipientId, message) → send nudge
    - AcknowledgeNudge(nudgeId) → confirm received

Messages:
  Server → Client:
    - presence.online { userId, status, lastSeen }
    - presence.offline { userId }
    - notification.new { id, type, title, message, actionUrl }
    - nudge.received { fromUser, templateName, message }

  Client → Server:
    - notification.mark-read { notificationId }
    - notification.delete { notificationId }
    - nudge.send { assignmentId, recipientId, message }
```

### 5.2 HTTP Fallback APIs

If WebSocket unavailable, use polling:

```
GET    /api/v1/platform/presence/online-users       # List online users
GET    /api/v1/platform/notifications                # Fetch notifications
PATCH  /api/v1/platform/notifications/:id/read       # Mark as read
DELETE /api/v1/platform/notifications/:id            # Delete

POST   /api/v1/platform/nudges                       # Send nudge
GET    /api/v1/platform/nudges/:id                   # Get nudge detail
```

### 5.3 Notification Preferences

```
GET    /api/v1/platform/notification-preferences
PATCH  /api/v1/platform/notification-preferences

Schema:
{
  "templateAssigned": { "enabled": true, "toast": true, "persistent": true },
  "deadlineReminder": { "enabled": true, "toast": true, "persistent": true },
  "nudge": { "enabled": true, "toast": true, "persistent": true },
  "escalation": { "enabled": true, "toast": true, "persistent": true },
  "quietHours": { "enabled": false, "startTime": "18:00", "endTime": "08:00" }
}
```

---

## 6. Accessibility Considerations

### 6.1 Notification Center

- Heading: `<h2>Notifications</h2>` (semantic)
- Drawer: `role="dialog"`, `aria-modal="true"`, focus trap
- Notification list: `<ul role="feed">`, each item `<li role="article">`
- Mark as read: `aria-label="Mark notification as read"`, keyboard shortcut (M key)
- Unread count badge: `aria-live="polite"` updates announced

### 6.2 Presence Indicators

- Dot + text both present; not color-only indicator
- Tooltip: `aria-label="Alice Johnson is online"` or `aria-describedby`
- Status: announced via screen reader on change (if `aria-live="polite"`)

### 6.3 Toast Notifications

- Toast: `role="status"` or `role="alert"` depending on importance
- `aria-live="assertive"` for urgent toasts (escalations, nudges)
- `aria-live="polite"` for informational toasts
- Auto-dismiss announced before dismissal (e.g., "Dismissing in 5 seconds")

### 6.4 Connection Status Indicator

- Indicator: Semantic text + icon (not icon alone)
- Tooltip: Describes current state
- Retry button: Keyboard accessible, clear label

---

## 7. Responsive Design Notes

### 7.1 Notification Center

- **Mobile:** Full-screen drawer or modal on bell click, covers content
- **Desktop:** Right-side drawer (400px width), overlays page
- Notification cards: Touch target ≥48px on mobile

### 7.2 Toast Notifications

- **Mobile:** Full width (with margin), bottom-left or top-right, stacks vertically
- **Desktop:** Fixed position bottom-right, max-width 400px, stacks vertically

### 7.3 Presence Indicators

- **Mobile:** Smaller dot size, tooltip may be limited (show on long-press instead)
- **Desktop:** Standard dot + tooltip on hover

### 7.4 Connection Status Indicator

- **Mobile:** Simplified text (just "Offline" instead of "Offline Mode")
- **Desktop:** Full text with optional retry button visible

---

## 8. Phased Rollout

### **Phase 1 (Sprint 9): WebSocket Connection & Presence**
- Set up SignalR / raw WebSocket client in TelemetryProvider
- Implement PresenceProvider with auto-sync of online users
- Add PresenceIndicator component (dots on avatars)
- Add ConnectionStatusIndicator to header
- Feature flag: `web.realtime-presence` gates presence features
- **Status:** Can see who's online; connection status visible
- Tests: WebSocket connection works, presence updates received, indicator renders

### **Phase 2 (Sprint 10): Notifications**
- Implement NotificationProvider with persistence (localStorage)
- Build NotificationCenter component (drawer + list)
- Build NotificationToast component (auto-dismiss)
- Implement mark-as-read + delete workflows
- Feature flag: `web.realtime-notifications` gates notifications
- **Status:** Receive real-time notifications + persistent list
- Tests: Notifications persist, mark-as-read works, toast displays and auto-dismisses

### **Phase 3 (Sprint 11): Nudges**
- Build NudgeModal component
- Implement send nudge API call
- Set up nudge message reception + notification creation
- Add nudge buttons to employee detail + assignment list pages
- Feature flag: `web.nudges-enabled` gates nudge UI
- **Status:** Supervisors can send nudges; employees receive with action button
- Tests: Nudge sends, employee receives notification with action link

### **Phase 4 (v0.7.0+): Graceful Degradation & Polish**
- Implement HTTP polling fallback when WebSocket unavailable
- Add notification preferences UI (quiet hours, notification types)
- Add alert/escalation management (critical alerts styled differently)
- Smoke tests on staging with real WebSocket + network interruptions
- **Status:** Fully resilient real-time, works offline
- Tests: Fallback to polling works, preferences save, escalations trigger

---

## 9. Dependencies & Tech Stack

| Dependency | Version | Purpose |
|------------|---------|---------|
| `@microsoft/signalr` | ^8.0+ | WebSocket client + fallback transport |
| OR `ws` | ^8.14+ | Raw WebSocket alternative |
| `react` | ^19+ | Core framework |
| `zustand` | ^4.4+ | State management for notifications |
| `date-fns` | ^2.30+ | Timestamp formatting |
| `lucide-react` | ^0.294+ | Icons for toasts, indicators |

---

## 10. Testing Strategy

### 10.1 Unit Tests

- **WebSocketProvider:** Connection lifecycle (connect, reconnect, disconnect), message dispatch
- **PresenceIndicator:** Renders correct dot color + tooltip based on status
- **NotificationCenter:** Marks as read, deletes notification, unread count updates
- **NotificationToast:** Auto-dismisses after duration, action button works
- **NudgeModal:** Form validates, send button calls API, confirmation shown

### 10.2 Integration Tests

- **Presence Flow:** User logs in → online status synced → indicator appears on team roster → user logs out → offline status synced
- **Notification Flow:** Assignment created → notification sent to employee → appears in notification center + toast → mark as read → unread count updates
- **Nudge Flow:** Supervisor sends nudge → employee receives notification → clicks action → navigates to assignment page

### 10.3 E2E Tests (Staging)

- Open two browser tabs (supervisor + employee)
- Supervisor sends nudge to employee
- Verify employee receives notification + toast in real-time
- Click action button → navigate to assignment page
- Verify presence dots update when supervisor logs out

### 10.4 Resilience Tests

- Disconnect WebSocket (DevTools → Network → Offline)
- Verify app switches to polling mode
- Reconnect network
- Verify WebSocket re-establishes

---

## 11. Rollback Plan

If real-time features break:

1. Set `web.realtime-{feature}` flag to `false`
2. App falls back to HTTP polling (if implemented) or static data
3. No error toasts shown; graceful degradation
4. Investigate error logs; fix and re-enable

If WebSocket connection is unstable:

1. Increase reconnect backoff (e.g., exponential: 1s, 2s, 4s, 8s, cap at 30s)
2. Add heartbeat interval to detect stale connections
3. Implement circuit breaker: if 5 consecutive reconnection failures, give up and use polling
4. Log connection errors for debugging

---

## 12. Success Metrics

| Metric | Target | Measurement |
|--------|--------|------------|
| Presence latency | <1s (P95) | Time from user login to dot appearing on team roster |
| Notification delivery time | <2s (P95) | Time from event creation to notification received by client |
| WebSocket uptime | >99% (P99) | Successful connections / total connection attempts |
| Message loss | 0% (on stable connection) | Verify all sent nudges received |
| Degraded mode performance | <5s (P95) polling latency | If using HTTP polling fallback |
| Toast visibility duration | 5-10s user adjustable | Auto-dismiss not too fast, not too slow |

---

## 13. Known Limitations & Future Work

1. **No offline queue** — future: queue messages sent while offline, deliver on reconnect
2. **No message persistence server-side** — future: store notifications for longer than session lifetime
3. **No read receipts for nudges** — future: confirm supervisor that employee read nudge
4. **No typing indicators** — future: show "User is typing..." in collaborative features (future)
5. **No direct messaging** — future: real-time chat between supervisor + employee
6. **No presence awareness for WebSocket health** — future: warn user if presence data is stale
