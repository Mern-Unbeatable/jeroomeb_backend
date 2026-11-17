# Specialist Feedback — Postman চেক

সার্ভার: `http://localhost:3000`

এই পেজ ক্লায়েন্ট আর টেন্যান্ট অ্যাডমিনের। সুপার অ্যাডমিন এই রাউটে `403` পায়। টোকেন না দিলে `401`।

`{{baseUrl}}` হল `http://localhost:3000/api/v1`।

কার্ডে যাকে **Assigned** দেখায়, সুপার অ্যাডমিন তাকে প্রপার্টির রোস্টারে বসিয়েছে। রোস্টার খালি থাকলে কার্ড খালি, আর নিচে `feedback` খালি অ্যারে।

## 1. ক্লায়েন্ট লগইন

`POST http://localhost:3000/api/v1/auth/login`

**Body → raw → JSON**

```json
{
  "email": "ক্লায়েন্টের ইমেইল",
  "password": "ক্লায়েন্টের পাসওয়ার্ড"
}
```

`token` কপি করে **Authorization → Bearer Token**-এ বসান। পরের ফিডব্যাক রাউটে এই টোকেন থাকবে।

## 2. রোস্টারে স্পেশালিস্ট না থাকলে

আগে সুপার অ্যাডমিন দিয়ে অ্যাসাইন করুন। অ্যাডমিন টোকেন আলাদা রিকোয়েস্টে দিন।

`POST http://localhost:3000/api/v1/auth/login`

```json
{
  "email": "admin@amenityops.com",
  "password": "AmenityAdmin#2026"
}
```

প্রপার্টি: `GET http://localhost:3000/api/v1/properties`। ক্লায়েন্টের কোম্পানির প্রপার্টির `id` নিন।

স্পেশালিস্ট: `GET http://localhost:3000/api/v1/specialists/applications`। `profile.id` নিন। এটা `SpecialistProfile`-এর id।

`POST http://localhost:3000/api/v1/properties/প্রপার্টির id/roster`

```json
{
  "specialistId": "profile.id",
  "assignment": "PRIMARY"
}
```

আশা করুন `200`। এর পর আবার ক্লায়েন্টের Bearer বসান।

## 3. পেজ লোড

`GET http://localhost:3000/api/v1/specialist-feedback`

বডি none। আশা করুন `200`।

`specialists` প্রতিটি অ্যাসাইন করা মানুষ একবার:

- `specialistId`
- `fullName`
- `code` — `OCS-` বা `SPC-`
- `roleLabel` — `Operations Continuity Specialist`
- `organizationName`
- `location` — সিটি আর স্টেট, না থাকলে `null`
- `place` — `কোম্পানির নাম — সিটি, স্টেট`
- `assignment` — `PRIMARY`, `BACKUP`, বা `IN_HOUSE`
- `status` — `ASSIGNED`

`feedback` আগের সাবমিট, নতুনটা আগে। খালি থাকলে `[]`। স্ক্রিনে তখন `No specialist feedback submitted yet`।

## 4. Submit Feedback

`POST http://localhost:3000/api/v1/specialist-feedback`

**Body → raw → JSON**

```json
{
  "specialistId": "ধাপ ৩-এর specialistId",
  "rating": 5,
  "comment": "Clear report and on time."
}
```

আশা করুন `201`। `rating` `1` থেকে `5`। `comment` খালি হলে `400`।

`feedback`-এ `id`, `specialistName`, `code`, `rating`, `comment`, `createdAt`।

আবার `GET` চাইলে `feedback` অ্যারেতে এই সারি আসে।

রোস্টারে নেই এমন `specialistId` দিলে `400` এবং `{ "message": "This specialist is not assigned to your property" }`।

## 5. ভুল টোকেন

Bearer সরিয়ে `GET`। আশা করুন `401`।

সুপার অ্যাডমিনের টোকেনে একই `GET`। আশা করুন `403` এবং `{ "message": "You do not have access to this" }`।
