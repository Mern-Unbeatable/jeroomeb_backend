# Software Only — Postman চেক

সার্ভার: `http://localhost:3000`

বডি **Body → raw → JSON**। ক্লায়েন্ট রিকোয়েস্টে **Authorization → Bearer Token** দিন।

Software Only আর Service + Software আলাদা টিয়ার। Software Only-এর দাম `$299`, `$449`, এবং Contact Us। Service + Software-এর দাম `$115`, `$170`, `$225`। একটার `priceBandId` অন্যটাতে দিলে `400` এবং `{ "message": "Plan not found" }`।

Software Only টিয়ার, যে সীমা আগে ছুঁবে সেটাই পরের টিয়ার:

| টিয়ার | দাম | সীমা |
| --- | --- | --- |
| Tier 1 (Baseline) | `$299.00` | ≤ 200 units / 250,000 sq ft |
| Tier 2 (Premier) | `$449.00` | ≤ 500 units / 600,000 sq ft |
| Tier 3 (Sovereign) | Contact Us | > 500 units / 600,000 sq ft |

Tier 3-এর `monthlyPrice` হলো `0` এবং `contactOnly` হলো `true`। এটা চেকআউট বা প্ল্যান বদল হয় না।

## 1. প্ল্যান দেখা

লগইন লাগে না।

`GET http://localhost:3000/api/v1/billing/plans?kind=SOFTWARE`

আশা করুন `200`। তিনটা প্ল্যান, এই ক্রমে। Tier 1-এর `maxUnits` `200`, `maxSquareFootage` `250000`, `limitLabel` `≤ 200 units / 250,000 sq ft`। Tier 2-এ `500`, `600000`, `≤ 500 units / 600,000 sq ft`। Tier 3-এ সীমা `null`, `contactOnly` `true`, `limitLabel` `> 500 units / 600,000 sq ft`। `plans[].id` কপি করুন।

Service + Software আলাদা দেখতে:

`GET http://localhost:3000/api/v1/billing/plans?kind=FULL_SERVICE`

এখানে `maxSquareFootage` `null`। দাম `115`, `170`, `225`।

## 2. সাইনআপ

`POST http://localhost:3000/api/v1/auth/register`

```json
{
  "fullName": "Sarah Chen",
  "email": "sarah.chen@apexcrest.example",
  "password": "ClientPass#2026",
  "phone": "(415) 882-3344",
  "companyName": "Apex Crest Properties LLC",
  "numberOfUnits": 180,
  "squareFootage": 210000,
  "propertyAddress": "742 Evergreen Promenade, Suite 1400, Austin, TX 78701"
}
```

`201`-এর `token` কপি করুন। `subscriptionStatus` হবে `UNPAID`। একই ইমেইলে আবার সাইনআপ করলে `409`।

ইউনিট `180` এবং স্কয়ার ফুটেজ `210000` Tier 1-এর ভিতরে। প্রগ্রেস হবে ইউনিটে `90` এবং স্কয়ার ফুটেজে `84`।

## 3. প্রথম প্ল্যান কেনা

`POST http://localhost:3000/api/v1/billing/checkout`

```json
{
  "priceBandId": "paste-tier-1-id"
}
```

আশা করুন `201`। `url` ব্রাউজারে খুলুন। টেস্ট কার্ড `4242 4242 4242 4242`, যেকোনো আগামি তারিখ, যেকোনো CVC, যেকোনো ZIP। `sessionId` কপি করুন।

Tier 3-এর আইডি দিলে `400` এবং `{ "message": "Contact us for this plan" }`।

পেমেন্টের পর:

`POST http://localhost:3000/api/v1/billing/confirm`

```json
{
  "sessionId": "paste-session-id"
}
```

আশা করুন `200`। `planKind` হবে `SOFTWARE` এবং `subscriptionStatus` হবে `ACTIVE`।

## 4. Overview

`GET http://localhost:3000/api/v1/dashboard`

বডি none। আশা করুন `200`।

- `plan.productName` — `Amenity OP's Application`
- `plan.name` — `Tier 1 (Baseline)`
- `plan.monthlyPrice` — `"299.00"`
- `plan.billingCycle` — `Monthly Recurring`
- `plan.status` — `Active`
- `property.unitCount` — `180`
- `property.squareFootage` — `210000`
- `tierStatus.withinCurrentTier` — `true`
- `tierStatus.message` — `Your current property size is within the applicable tier.`
- `tierStatus.units` — `current` `180`, `threshold` `200`, `percent` `90`
- `tierStatus.squareFootage` — `current` `210000`, `threshold` `250000`, `percent` `84`
- `tierStatus.nextTier.name` — `Tier 2 (Premier)`, `monthlyPrice` `"449.00"`
- `softwareTiers` — তিনটা কার্ড। চালু টিয়ারের `current` `true`। Tier 3-এর `limitLabel` `> 500 units / 600,000 sq ft`

পেমেন্টের আগে এই কল `403` এবং `{ "message": "Choose a plan and complete payment to open the dashboard" }`। টোকেন না দিলে `401`।

## 5. প্রপার্টি এডিট

Overview-এর Edit Property Information।

`PATCH http://localhost:3000/api/v1/properties/me`

```json
{
  "name": "Apex Crest Luxury Residences",
  "street": "742 Evergreen Promenade, Suite 1400",
  "city": "Austin",
  "state": "TX",
  "zip": "78701",
  "unitCount": 180,
  "squareFootage": 210000
}
```

আশা করুন `200`। `address` হবে `742 Evergreen Promenade, Suite 1400, Austin, TX 78701`। খালি `{}` দিলে `400`। অ্যাডমিন টোকেনে `403`।

ইউনিট `220` করলে পরের `GET /dashboard`-এ `withinCurrentTier` হয় `false` এবং মেসেজ হয় `Your property size has reached the next tier.` ইউনিটের `percent` হয় `110`।

## 6. সাবস্ক্রিপশন

`GET http://localhost:3000/api/v1/billing/subscription`

বডি none। আশা করুন `200`।

- `currentPlan.productName` — `Amenity OP's Application`
- `currentPlan.name` — `Tier 1 (Baseline)`
- `currentPlan.status` — `Active`
- `currentPlan.amount` — `"299.00"`
- `currentPlan.billingCycle` — `Monthly Recurring`
- `currentPlan.paymentStatus` — `Paid`
- `currentPlan.autoRenew` — `true` মানে Auto-Renew Enabled
- `currentPlan.nextBilling` — পরের বিলের তারিখ
- `availablePlans` — শুধু Software Only-এর তিনটা টিয়ার। Service + Software-এর `$115` এখানে আসে না

UNPAID অ্যাকাউন্টে `403` এবং `{ "message": "This page is available on a Software Only or Service + Software plan" }`।

## 7. অন্য টিয়ার

`POST http://localhost:3000/api/v1/billing/subscription`

```json
{
  "priceBandId": "paste-tier-2-id"
}
```

আশা করুন `200`। `amount` হয় `"449.00"`। আজ টাকা কাটে না। নতুন দাম `nextBilling` তারিখের ইনভয়েসে লাগে।

একই টিয়ার আবার দিলে `409` এবং `{ "message": "This plan is already active" }`। Tier 3 দিলে `400` এবং `{ "message": "Contact us for this plan" }`। Service + Software-এর আইডি দিলে `400` এবং `{ "message": "Plan not found" }`।

## 8. Cancel Subscription

এটা আসল সাবস্ক্রিপশন বন্ধ করে। টেস্টের শেষে চালান।

`POST http://localhost:3000/api/v1/billing/subscription/cancel`

বডি none। আশা করুন `200`। স্ট্যাটাস `Active` থাকে `nextBilling` পর্যন্ত। `autoRenew` হয় `false`। `cancelAtPeriodEnd` হয় `true`। `cancelsOn`-এ সেই তারিখ থাকে।

আবার Cancel চাপলে `409` এবং `{ "message": "This plan is already cancelled" }`।

## 9. বিলিং লেজার

`GET http://localhost:3000/api/v1/billing/ledger`

বডি none। আশা করুন `200`।

- `paymentMethod` — `brand` এবং `last4`। পুরো কার্ড নম্বর থাকে না
- `invoices` — Recent Invoices এবং Recent Transactions। `description` মাসিক রিনিউয়ালে `Monthly SaaS Subscription Renewal`
- `totalSettled` — `Paid` এবং `Completed` ইনভয়েসের যোগফল
- `serviceLedger` — Software Only-তে খালি অ্যারে `[]`

পেমেন্ট না থাকলে `403` এবং `{ "message": "The billing ledger is available on an active Software Only or Service + Software plan" }`। অ্যাডমিন টোকেনে `403` এবং `{ "message": "You do not have access to this" }`।

একটা ইনভয়েস, `invoices[].id` কপি করুন:

`GET http://localhost:3000/api/v1/billing/invoices/<invoice-id>`

PDF:

`GET http://localhost:3000/api/v1/billing/invoices/<invoice-id>/pdf`

Postman-এ **Send and Download** চাপুন।

## 10. পেমেন্ট মেথড

কার্ড নম্বর এই বডিতে দেবেন না।

`POST http://localhost:3000/api/v1/billing/payment-method`

```json
{}
```

আশা করুন `201`। `url` খুলে নতুন কার্ড সেভ করুন। তারপর:

`POST http://localhost:3000/api/v1/billing/payment-method/confirm`

```json
{
  "sessionId": "paste-session-id"
}
```

আশা করুন `200` এবং `paymentMethod.last4`। সেভ না করে কনফার্ম করলে `400` এবং `{ "message": "Payment method was not saved" }`।

## 11. প্রোফাইল

`GET http://localhost:3000/api/v1/auth/me`

আশা করুন `200`। উত্তর `user`-এর ভিতরে। `fullName`, `email`, `phone`, `companyName`, `numberOfUnits`, `squareFootage`, `propertyAddress`, `accountRole`। ক্লায়েন্টের `accountRole` হয় `Authorized Client Admin`।

সেভ:

`PATCH http://localhost:3000/api/v1/auth/me`

```json
{
  "fullName": "Sarah Chen",
  "phone": "(415) 882-3344",
  "companyName": "Apex Crest Properties LLC",
  "numberOfUnits": 180,
  "squareFootage": 210000,
  "propertyAddress": "742 Evergreen Promenade, Suite 1400, Austin, TX 78701"
}
```

আশা করুন `200`। অন্য অ্যাকাউন্টের ইমেইল দিলে `409` এবং `{ "message": "An account with this email already exists" }`।

পাসওয়ার্ড আলাদা:

`POST http://localhost:3000/api/v1/auth/change-password`

```json
{
  "currentPassword": "ClientPass#2026",
  "newPassword": "ClientPass#2027",
  "confirmPassword": "ClientPass#2027"
}
```

আশা করুন `200` এবং `{ "message": "Password updated" }`। বর্তমান পাসওয়ার্ড ভুল হলে `400` এবং `{ "message": "Current password is incorrect" }`।
