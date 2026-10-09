# MyMap Live Safety & Crowd Privacy

## Privacy model
- Exact live coordinates are readable only by the owner and accepted connections when exact sharing is enabled.
- Non-friends never receive user rows or exact coordinates.
- Public crowd state is computed from short-lived presence (5-minute TTL) into ~1 km cells.
- A crowd cell is visible only when at least 5 active users are present; the client receives only a qualitative level: moderate, busy, very_busy.
- Location requests are allowed only between accepted connections and require the target to explicitly accept or decline.

## SOS model
- SOS creates a server-side emergency event and optional continuous location updates.
- Registered trusted contacts receive an in-app notification and can read the SOS location only when explicitly authorized by the owner.
- Phone-only trusted contacts are returned to the device so the user can send an SMS through the native messaging UI.
- The app never silently places an emergency-services call. It opens the OS dialer with the locally verified number and the user confirms the call.
- If a country/type has no verified number in `vc_emergency_numbers`, the app must not guess a number.

## Backend
- `vc_connections`
- `vc_live_presence`
- `vc_crowd_cells`
- `vc_location_requests`
- `vc_trusted_contacts`
- `vc_emergency_events`
- `vc_emergency_event_updates`
- `vc_emergency_numbers`
- `vc_notifications`
- Edge Functions: `mymap-presence`, `mymap-sos`
