# Check the API in Postman

The dev server is `http://localhost:3000`. Every request below uses **Body → raw → JSON**.

Seeded super admin (from `.env`):

- Email: `admin@amenityops.com`
- Password: `AmenityAdmin#2026`

Login and register return a `token` and also set an httpOnly cookie named `access_token`. Either one is enough for `GET /me`:

- **Bearer:** copy `token` from the login response. In Postman open the **Authorization** tab, choose **Bearer Token**, and paste it.
- **Cookie:** leave Authorization on **No Auth**. Postman stores `access_token` from the `Set-Cookie` header and sends it on the next request to `localhost`.

## 1. Health

`GET http://localhost:3000/health`

Expect `200`:

```json
{ "ok": true, "message": "Server is running" }
```

## 2. Login

`POST http://localhost:3000/api/v1/auth/login`

```json
{
  "email": "admin@amenityops.com",
  "password": "AmenityAdmin#2026"
}
```

Expect `200` with `user.role` equal to `SUPER_ADMIN`, a `token`, and a `Set-Cookie: access_token=...; HttpOnly` header.

A wrong password returns `401` with `{ "message": "Invalid email or password" }`.

## 3. Current user

`GET http://localhost:3000/api/v1/auth/me`

Send the Bearer token or the cookie from login. Expect `200` and the same user, with no password hash.

With no token and no cookie, expect `401` and `{ "message": "Authentication required" }`.

## 4. Register

`POST http://localhost:3000/api/v1/auth/register`

```json
{
  "fullName": "Jordan Hale",
  "email": "jordan@northstar.example",
  "password": "northstar-pass",
  "phone": "555-0100",
  "companyName": "Northstar Communities",
  "numberOfUnits": 120,
  "squareFootage": 84000,
  "propertyAddress": "100 Harbor Ave, Miami, FL"
}
```

Expect `201`. The response user has `role` `CLIENT` and an `organization`. This also creates a draft property for that company. Password must be 8 to 72 characters.

Send the same email again. Expect `409` and `{ "message": "An account with this email already exists" }`.

Drop a required field. Expect `400` and `{ "message": "Invalid request", "errors": { ... } }`.

## 5. Forgot password — email

`POST http://localhost:3000/api/v1/auth/forgot-password`

```json
{
  "email": "admin@amenityops.com"
}
```

Expect `200`. The API emails that address a 5-digit code from the Gmail account in `.env`. In development the body also includes `otp` and `expiresAt`. Copy `otp`, or take it from the email. An unknown email still returns `200` and the same message, with no email and no `otp`.

`admin@amenityops.com` is only a seed login. To see the message in an inbox, register with a real address first, then call forgot-password for that address.

## 6. Forgot password — OTP

`POST http://localhost:3000/api/v1/auth/verify-otp`

```json
{
  "email": "admin@amenityops.com",
  "otp": "12345"
}
```

`otp` is a 5-digit string. Expect `200` with `{ "message": "Code verified", "resetToken": "..." }`. Copy `resetToken` for the next step. A wrong code returns `400` and `{ "message": "Invalid or expired code" }`. The code lasts 60 minutes.

## 7. Forgot password — new password

`POST http://localhost:3000/api/v1/auth/reset-password`

```json
{
  "resetToken": "paste-resetToken-here",
  "password": "AmenityAdmin#2026",
  "confirmPassword": "AmenityAdmin#2026"
}
```

`password` and `confirmPassword` must match. Expect `200` and `{ "message": "Password updated" }`. If they differ, expect `400` and `{ "message": "Passwords do not match" }`. Using the same `resetToken` again returns `400`.

If you change the admin password here, put the new value back into `SEED_ADMIN_PASSWORD` in `.env`, or log in with the new password. The example above sets it back to the seeded password.

## 8. Logout

`POST http://localhost:3000/api/v1/auth/logout`

No body. Expect `200` and `{ "message": "Logged out" }`. The `access_token` cookie is cleared. A Bearer token copied earlier still works until it expires (30 days).

## 9. Contact

`POST http://localhost:3000/api/v1/contact`

```json
{
  "name": "Jordan Hale",
  "email": "jordan@northstar.example",
  "phone": "555-0100",
  "message": "We need overnight coverage for two communities."
}
```

Expect `201` and a saved `message`. No login is required. Copy `message.id`.

List and delete need the super admin token from login.

`GET http://localhost:3000/api/v1/contact`

Authorization: Bearer token. Expect `200` and `messages`, newest first. With no token, expect `401`.

`DELETE http://localhost:3000/api/v1/contact/<message-id>`

Expect `200` and `{ "message": "Contact message deleted" }`. An unknown id returns `404`.

## 10. Quote wizard

Load the choices first.

`GET http://localhost:3000/api/v1/service-requests/options`

Expect `200` with `propertyTypes` and `services`. Copy one or more service `id` values. Send the whole quote once, on Submit.

`POST http://localhost:3000/api/v1/service-requests`

```json
{
  "propertyType": "Residential Multi-Tenant",
  "unitCount": 200,
  "buildingCount": 2,
  "serviceIds": ["paste-service-id"],
  "name": "Ismail Molla",
  "company": "maktech",
  "email": "ismail.maktech@gmail.com",
  "phone": "01780053624",
  "propertyInformation": "My property name is Shwapno Villa. There are 200 rooms and 100 kitchens.",
  "informationConfirmed": true
}
```

Expect `201`, one request with status `PENDING_REVIEW` and a code starting with `SR-`. `informationConfirmed` must be true, and at least one service is required. With no login token, the request is still saved.

## 10a. Admin service requests

These need the super admin token.

`GET http://localhost:3000/api/v1/service-requests`

Expect `200` with `counts` (total, pending review, in progress, approved, completed) and `requests`. Add `?status=Pending Review` to filter the table. The cards stay as overall counts.

`GET http://localhost:3000/api/v1/service-requests/<id>`

Expect `200` and one `serviceRequest`. This is See Details.

`PATCH http://localhost:3000/api/v1/service-requests/<id>/status`

```json
{ "status": "Approved" }
```

`status` is `Approved`, `Cancel`, `Ongoing`, or `Completed`. Expect `200`. Each change is written to the activity log.

`DELETE http://localhost:3000/api/v1/service-requests/<id>`

Expect `200` and `{ "message": "Service request deleted" }`. An unknown id returns `404`. With no token, expect `401`.

## 11. Specialist application

`GET http://localhost:3000/api/v1/specialists/options` returns the travel ranges, shifts, property types, and comfort ratings.

Send the whole application once, on Submit Application.

`POST http://localhost:3000/api/v1/specialists/applications`

```json
{
  "fullName": "Riley Chen",
  "phone": "555-0142",
  "email": "riley@example.com",
  "location": "Miami, FL",
  "travelRange": "10-25 miles",
  "shiftAvailability": ["Overnight"],
  "premiumPropertyExperience": false,
  "propertyTypes": ["Luxury High-Rises"],
  "assetProtectionExperience": "Night walks, pool closes, and access-control checks.",
  "complianceExperience": "NFPA life safety and local fire code.",
  "comfortRating": 4,
  "multiPointInspection": "Log the leak, then clear the blocked exit before leaving.",
  "handOffBrief": "Open items, access issues, and anything life safety.",
  "riskReduction": "Found a blocked exit, had it cleared, and noted it for the morning team.",
  "hasTransportation": true,
  "canDoMultiPointInspection": true,
  "backgroundCheckConsent": true,
  "informationConfirmed": true
}
```

Expect `201`. `user.role` is `SPECIALIST` and `profile.applicationStatus` is `SUBMITTED`. `informationConfirmed` must be true. Background check may be yes or no. Password is optional because the form does not ask for one. The same email again returns `409`. Copy `profile.id`.

Admin list, detail, and delete need the super admin token.

`GET http://localhost:3000/api/v1/specialists/applications`

Expect `200` and `applications`, newest first. With no token, expect `401`.

`GET http://localhost:3000/api/v1/specialists/applications/<profile-id>`

Expect `200` and one `application`. An unknown id returns `404`.

`DELETE http://localhost:3000/api/v1/specialists/applications/<profile-id>`

Expect `200` and `{ "message": "Specialist application deleted" }`. This removes the application and that specialist user.

## 12. Affiliate application

`POST http://localhost:3000/api/v1/affiliates/applications`

`GET http://localhost:3000/api/v1/affiliates/options` returns the allowed choices. Business type is only `Hotel`, `Restaurant`, `Villa`, or `Property`.

Send the whole application once, on Submit Application.

```json
{
  "companyName": "Brooks Property Partners",
  "fullName": "Avery Brooks",
  "jobTitle": "Principal",
  "email": "avery@example.com",
  "phone": "555-0199",
  "website": "https://example.com",
  "businessType": "Property",
  "markets": "Miami, Fort Lauderdale, and West Palm Beach",
  "decisionMakers": ["Property Owners / Landlords", "Asset Managers"],
  "propertyTypes": ["Premium Residential / Luxury Multi-Family High-Rises"],
  "portfolioSize": "1-5 Properties",
  "introMethods": ["Direct warm email / phone introductions to specific property managers"],
  "quarterlyIntroductions": "1-3 per quarter",
  "partnershipFit": "Owners in this market have no overnight amenity coverage.",
  "termsAccepted": true,
  "taxAcknowledged": true,
  "informationConfirmed": true
}
```

Expect `201`. `user.role` is `AFFILIATE` and `profile.applicationStatus` is `SUBMITTED`. The three agreement checkboxes must be true. A business type outside those four returns `400`. Password is optional because the form does not ask for one. Copy `profile.id`.

Admin list and detail need the super admin token.

`GET http://localhost:3000/api/v1/affiliates/applications`

Expect `200` and `applications`, newest first. With no token, expect `401`.

`GET http://localhost:3000/api/v1/affiliates/applications/<profile-id>`

Expect `200` and one `application` with the partner profile, market reach, strategy, and terms. An unknown id returns `404`.

`DELETE http://localhost:3000/api/v1/affiliates/applications/<profile-id>`

Expect `200` and `{ "message": "Affiliate application deleted" }`. This removes the application and that affiliate user. Deleting the same id again returns `404`.
