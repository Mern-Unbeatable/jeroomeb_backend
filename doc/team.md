# Team Members — Postman চেক

সার্ভার: `http://localhost:3000`

শুধু সুপার অ্যাডমিন। **Authorization → Bearer Token** দিন। টোকেন না দিলে `401`। টিম মেম্বার বা ক্লায়েন্ট `403` এবং `{ "message": "You do not have access to this" }`।

`{{baseUrl}}` ব্যবহার করলে সেটার মান `http://localhost:3000/api/v1`। নিচের উদাহরণ পুরো URL।

## 1. সুপার অ্যাডমিন লগইন

`POST http://localhost:3000/api/v1/auth/login`

**Body → raw → JSON**

```json
{
  "email": "admin@amenityops.com",
  "password": "AmenityAdmin#2026"
}
```

আশা করুন `200`। `token` কপি করে পরের রিকোয়েস্টে Bearer Token-এ বসান।

## 2. কোম্পানি বেছে নেওয়া

`GET http://localhost:3000/api/v1/organizations`

বডি none। আশা করুন `200`। `tenants` অ্যারে থেকে একটা `id` কপি করুন। এটাই ফর্মের Assigned Organization।

## 3. Add Team Member

`POST http://localhost:3000/api/v1/team`

**Body → raw → JSON**

```json
{
  "organizationId": "ধাপ ২-এর id",
  "fullName": "Alex Rivera",
  "email": "kamrul.maktech+alex@gmail.com",
  "password": "",
  "role": "SPECIALIST"
}
```

আশা করুন `201`।

`role` দুটো: `SPECIALIST` (Operations Continuity Specialist) অথবা `TENANT_ADMIN` (সেই কোম্পানির অ্যাডমিন)।

`password` খালি থাকলে সার্ভার ১৪ অক্ষরের পাসওয়ার্ড বানিয়ে ওই ইমেইলে পাঠায়। রেসপন্সে পাসওয়ার্ড থাকে না। নিজে পাসওয়ার্ড দিতে চাইলে `""` এর জায়গায় অন্তত ৮ অক্ষর দিন।

রেসপন্সের `member`:

- `id` — পরের রাউটে এইটা `:id`
- `code` — `OCS-` দিয়ে শুরু
- `specialistId`
- `role` আর `roleLabel`
- `setupPending` — `true`, কারণ প্রথম লগইনে পাসওয়ার্ড বদলাতে হবে
- `openCount` — চলমান ইনস্পেকশন, নতুন মেম্বারে `0`
- `organization` — `{ id, name }`
- `location` — সিটি আর স্টেট না থাকলে `null`

একই ইমেইল আবার দিলে `409` এবং `{ "message": "An account with this email already exists" }`। ভুল `organizationId`-তে `404`।

## 4. Active Team Members

`GET http://localhost:3000/api/v1/team?organizationId=ধাপ ২-এর id`

বডি none। Params-এ `organizationId`। আশা করুন `200`।

`count` মেম্বার সংখ্যা। `members`-এ শুধু `ACTIVE` স্পেশালিস্ট আর টেন্যান্ট অ্যাডমিন। `setupPending` `true` হলে স্ক্রিনে Setup Pending। `openCount` হল `2 open`-এর সংখ্যা। Deactivate করা মেম্বার এই লিস্টে নেই।

`organizationId` না দিলে সব কোম্পানির সক্রিয় মেম্বার আসে।

## 5. Make Admin

`POST http://localhost:3000/api/v1/team/মেম্বারের id/make-admin`

বডি none। আশা করুন `200`। `role` হয় `TENANT_ADMIN`। `code` আগের `OCS-` কোডই থাকে। আগে থেকে অ্যাডমিন হলে `409` এবং `{ "message": "This member is already an admin" }`।

## 6. Make Specialist

`POST http://localhost:3000/api/v1/team/মেম্বারের id/make-specialist`

বডি none। আশা করুন `200`। `role` হয় `SPECIALIST`। কোড থাকে। আগে থেকে স্পেশালিস্ট হলে `409` এবং `{ "message": "This member is already a specialist" }`।

## 7. Deactivate

`POST http://localhost:3000/api/v1/team/মেম্বারের id/deactivate`

বডি none। আশা করুন `200`। `status` হয় `DISABLED`। আবার লিস্ট চাইলে এই মেম্বার থাকবে না। লগইন বন্ধ। আবার ডিঅ্যাকটিভেট করলে `409` এবং `{ "message": "This member is already deactivated" }`।

## 8. Delete

`DELETE http://localhost:3000/api/v1/team/মেম্বারের id`

বডি none। রোস্টার বা ইনস্পেকশন না থাকলে `200` এবং `{ "message": "Team member removed" }`। অ্যাসাইন করা থাকলে `409` এবং `{ "message": "This member is assigned to properties or inspections" }`।

## 9. টোকেন ছাড়া আর ক্লায়েন্ট

Bearer সরিয়ে `GET /api/v1/team`। আশা করুন `401`।

ক্লায়েন্টের `token` দিয়ে একই GET। আশা করুন `403` এবং `{ "message": "You do not have access to this" }`।
