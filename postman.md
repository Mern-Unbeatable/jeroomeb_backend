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

No body. Expect `200` and `{ "message": "Logged out" }`. The `access_token` cookie is cleared. A Bearer token copied earlier still works until it expires (7 days).
