# বিলিং এবং প্ল্যান — Postman চেক

সার্ভার: `http://localhost:3000`

Postman-এ বডি **Body → raw → JSON**। যেখানে টোকেন লাগে, **Authorization → Bearer Token** দিন।

সাইনআপ অ্যাকাউন্ট খোলে, কিন্তু ড্যাশবোর্ড বন্ধ থাকে। ইউজার Software Only অথবা Service + Software বেছে নেয়। Service + Software-এ তিনটা মাসিক প্যাকেজ: Tier 1 (Baseline), Tier 2 (Premier), Tier 3 (Sovereign)। স্ট্রাইপ Checkout-এ পেমেন্ট হলে ড্যাশবোর্ড খোলে। আগে থেকে বানানো Stripe Price ID লাগে না। ওয়েবহুক লাগে না।

স্ট্রাইপ সিক্রেট কি শুধু `.env`-এ থাকে। Postman-এ সেটা পাঠাতে হয় না।

## 1. প্ল্যান দেখা

লগইন লাগে না।

`GET http://localhost:3000/api/v1/billing/plans`

Service + Software শুধু দেখতে:

`GET http://localhost:3000/api/v1/billing/plans?kind=FULL_SERVICE`

Software Only:

`GET http://localhost:3000/api/v1/billing/plans?kind=SOFTWARE`

`200`-এ `options`, `propertyTypes`, `plans`, এবং `publishableKey` আসে। `plans[].id` এবং `plans[].monthlyPrice` কপি করুন। দাম ডলারে, যেমন `115` মানে `$115.00/month`।

## 2. সাইনআপ

`POST http://localhost:3000/api/v1/auth/register`

```json
{
  "fullName": "Marcus Chen",
  "email": "m.chen@northgate.example",
  "password": "ClientPass#2026",
  "phone": "(415) 882-3344",
  "companyName": "Northgate Properties LLC",
  "numberOfUnits": 150,
  "squareFootage": 2400,
  "propertyAddress": "450 Market Street, Suite 900, San Francisco, CA 94105"
}
```

`201` এর `token` কপি করুন। `user.organization.subscriptionStatus` হবে `UNPAID`। এই টোকেন দিয়ে বাকি ক্লায়েন্ট রিকোয়েস্ট চলবে।

একই ইমেইলে আবার সাইনআপ করলে `409`।

## 3. পেমেন্টের আগে ড্যাশবোর্ড বন্ধ

`GET http://localhost:3000/api/v1/dashboard`

আশা করুন `403` এবং `{ "message": "Choose a plan and complete payment to open the dashboard" }`।

## 4. Checkout

`POST http://localhost:3000/api/v1/billing/checkout`

```json
{
  "priceBandId": "paste-plan-id",
  "propertyType": "Luxury Condominium"
}
```

`priceBandId` হলো `GET /billing/plans` এর `plans[].id`। `propertyType` না দিলেও চলে। দেওয়া হলে সাইনআপের প্রপার্টির টাইপ আপডেট হয়। `successUrl` এবং `cancelUrl` পাঠাতে হয় না। না দিলে পেমেন্টের পর `https://jeroomeb.maktechgroup.tech` এ ফিরে যায়।

আশা করুন `201`। রেসপন্সের `sessionId` কপি করুন। `url` ব্রাউজারে খুলুন। টেস্ট কার্ড:

- নম্বর `4242 4242 4242 4242`
- যেকোনো আগামি তারিখ
- যেকোনো CVC
- যেকোনো ZIP

পেমেন্ট হলে আগের `201` রেসপন্সের `sessionId` দিয়ে পরের ধাপ চালান। এটা `cs_test_` দিয়ে শুরু।

দাম `$0` হলে চেকআউট হয় না। `400` এবং `{ "message": "This plan cannot be checked out" }`। অ্যাকাউন্ট আগে থেকে `ACTIVE` হলে `409`।

## 5. পেমেন্ট নিশ্চিত

`POST http://localhost:3000/api/v1/billing/confirm`

```json
{
  "sessionId": "paste-session-id"
}
```

স্ট্রাইপ থেকে সেশন পড়া হয়। `payment_status` যখন `paid`, তখন কোম্পানি `ACTIVE` হয় এবং প্ল্যান সেভ হয়।

আশা করুন `200`। `subscriptionStatus` হবে `ACTIVE`। `plan.name` এবং `plan.monthlyPrice` কিনে নেওয়া প্যাকেজ।

এখনো না দিয়ে কনফার্ম করলে `400` এবং `{ "message": "Payment is not complete" }`। অন্য অ্যাকাউন্টের সেশন দিলে `403`।

## 6. ড্যাশবোর্ড

আবার:

`GET http://localhost:3000/api/v1/dashboard`

আশা করুন `200`।

- `user.fullName`
- `property.name` এবং `property.address`
- `cards.activeServices` হবে `1`
- `cards.ongoingOrPendingRequests`
- `services[0]` কিনে নেওয়া প্যাকেজ, `status` হবে `Active`

পরের মাসে সাবস্ক্রিপশন বন্ধ হলে এই কল স্ট্রাইপকে জিজ্ঞেস করে। আর অ্যাকটিভ না থাকলে ড্যাশবোর্ড আবার `403`।

## 7. অ্যাডমিন দাম এডিট

আলাদা ট্যাবে অ্যাডমিন লগইন করুন। ক্লায়েন্ট টোকেন দিয়ে দাম বদলানো যায় না।

`POST http://localhost:3000/api/v1/auth/login`

```json
{
  "email": "admin@amenityops.com",
  "password": "AmenityAdmin#2026"
}
```

সব ব্যান্ড:

`GET http://localhost:3000/api/v1/price-bands`

একটা দাম বদলাতে:

`PATCH http://localhost:3000/api/v1/price-bands/<price-band-id>`

```json
{
  "monthlyPrice": 180,
  "name": "Tier 2 (Premier)"
}
```

`name` বা `active` না দিলেও চলে। শুধু দাম বদলাতে `monthlyPrice` দিলেই হয়। `active: false` করলে নতুন চেকআউটে এই প্ল্যান আর আসে না।

আশা করুন `200` এবং `priceBand.monthlyPrice` নতুন দাম। ভুল আইডি হলে `404`।

এর পর `GET /api/v1/billing/plans` এ নতুন দাম দেখা যাবে। নতুন Checkout এই দামই নেয়। আগে খোলা unpaid Checkout সেশনের দাম বদলায় না।
