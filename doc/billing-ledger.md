# বিলিং লেজার — Postman চেক

সার্ভার: `http://localhost:3000`

বডি **Body → raw → JSON**। ক্লায়েন্ট রিকোয়েস্টে **Authorization → Bearer Token** দিন।

এই স্ক্রিন শুধু `FULL_SERVICE` এবং `ACTIVE` ক্লায়েন্টের। ইনভয়েস Stripe-এ থাকে। কার্ড নম্বর, CVC, রাউটিং নম্বর, বা ব্যাংক অ্যাকাউন্ট নম্বর এই API-তে পাঠানো হয় না।

## 1. ক্লায়েন্ট লগইন

`POST http://localhost:3000/api/v1/auth/login`

```json
{
  "email": "client-email",
  "password": "client-password"
}
```

`token` কপি করে Bearer Token-এ বসান। অ্যাকাউন্ট Service + Software কিনে `ACTIVE` হতে হবে। না হলে লেজার `403` এবং `{ "message": "The billing ledger is available on an active Software Only or Service + Software plan" }`।

## 2. লেজার

`GET http://localhost:3000/api/v1/billing/ledger`

বডি none। আশা করুন `200`।

- `paymentMethod` — বর্তমান কার্ড বা ব্যাংক। `brand` এবং `last4` থাকে, পুরো নম্বর থাকে না। কিছু না থাকলে `null`।
- `invoices` — Invoices ট্যাব। তারিখ, `transactionId`, `description`, `amount`, `status`, `invoiceNumber`।
- `totalSettled` — `Paid` এবং `Completed` ইনভয়েসের যোগফল, ডলারে। যেমন `"299.00"`।
- `serviceLedger` — Service Ledger ট্যাব। টাকা নেই।

মাসিক রিনিউয়ালের `description` হয় `Monthly SaaS Subscription Renewal`। দাম `0` হলে স্ট্যাটাস `Completed`। বাকি পেইড ইনভয়েসের স্ট্যাটাস `Paid`।

`serviceLedger` স্ট্যাটাস:

- `Pending` — `Service request submitted, pending approval`
- `Active` — অ্যাড-অনে `Service request approved and activated`। মেইন সার্ভিসে `Monthly service period commenced`
- `Ongoing` — `Service request approved and activated`
- `Completed` — `Service request completed`

টোকেন না দিলে `401`। অ্যাডমিন টোকেনে `403` এবং `{ "message": "You do not have access to this" }`।

## 3. একটা ইনভয়েস

`invoices[].id` কপি করুন। সেটা `in_` দিয়ে শুরু।

`GET http://localhost:3000/api/v1/billing/invoices/<invoice-id>`

আশা করুন `200`। `companyName`, `subtotal`, `total`, `amountPaid`, `balanceDue`, এবং `downloadPath` আসে। অন্য ক্লায়েন্টের ইনভয়েসে `403`। ভুল আইডিতে `404`।

PDF ডাউনলোড, একই ক্লায়েন্ট টোকেন:

`GET http://localhost:3000/api/v1/billing/invoices/<invoice-id>/pdf`

Postman-এ **Send and Download** চাপুন। ফাইলটা AmenityOps ইনভয়েস: কোম্পানির নাম, তারিখ, ট্রানজ্যাকশন আইডি, বর্ণনা, সাবটোটাল, টোটাল, পরিশোধিত টাকা, বাকি, এবং কার্ডের শেষ ৪ সংখ্যা। প্রিন্ট ফ্রন্টএন্ডে হবে।

## 4. পেমেন্ট মেথড বদলানো

কার্ড বা ব্যাংক ডিটেইল এই বডিতে দেবেন না।

`POST http://localhost:3000/api/v1/billing/payment-method`

```json
{}
```

খালি অবজেক্টই যথেষ্ট। আশা করুন `201`। `url` ব্রাউজারে খুলুন। Stripe-এর পেজে কার্ড বা Corporate ACH সেভ করুন। সাকসেস URL থেকে `session_id` কপি করুন।

নিশ্চিত করা:

`POST http://localhost:3000/api/v1/billing/payment-method/confirm`

```json
{
  "sessionId": "paste-session-id"
}
```

Stripe সেভ বললে তবেই এই কার্ড বা ব্যাংক ডিফল্ট হয়। আশা করুন `200` এবং `paymentMethod.last4`। সেভ না করে কনফার্ম করলে `400` এবং `{ "message": "Payment method was not saved" }`।

আবার `GET /api/v1/billing/ledger` করলে নতুন `paymentMethod` দেখা যাবে।

## 5. সাবস্ক্রিপশন স্ক্রিন

একই ক্লায়েন্ট টোকেন। অ্যাকাউন্ট `FULL_SERVICE` হতে হবে। `ACTIVE` না থাকলে পেজ খোলে, কিন্তু প্ল্যান বদল বা Cancel হয় না।

`GET http://localhost:3000/api/v1/billing/subscription`

বডি none। আশা করুন `200`।

- `currentPlan.propertyTypeLabel` — যেমন `Luxury Condominium`
- `currentPlan.name` — যেমন `Tier 1 (Baseline)`
- `currentPlan.status` — `Active` বা `Cancelled`
- `currentPlan.nextBilling` — পরের বিলের তারিখ, ISO। Cancelled হলে `null`
- `currentPlan.amount` — যেমন `"115.00"`
- `currentPlan.cancelAtPeriodEnd` — Cancel চাপার পর `true`
- `currentPlan.cancelsOn` — যে তারিখে প্ল্যান বন্ধ হবে
- `propertyTypes` — ড্রপডাউনের চারটা টাইপ
- `availablePlans` — Tier 1 `"115.00"`, Tier 2 `"170.00"`, Tier 3 `"225.00"`। চালু টিয়ারের `current` হয় `true`

`availablePlans[].id` কপি করুন। সেটাই পরের বডির `priceBandId`।

টোকেন না দিলে `401`। অ্যাডমিন টোকেনে `403` এবং `{ "message": "You do not have access to this" }`। Software Only অ্যাকাউন্টে `403` এবং `{ "message": "This page is available on a Service + Software plan" }`।

## 6. অন্য টিয়ার বেছে নেওয়া

`POST http://localhost:3000/api/v1/billing/subscription`

```json
{
  "priceBandId": "paste-tier-id",
  "propertyType": "Luxury Condominium"
}
```

`propertyType` না দিলেও চলে। দেওয়া হলে সর্বশেষ প্রপার্টির টাইপ আপডেট হয়। লেবেল বা কোড দুটোই চলে: `Luxury Condominium` অথবা `LUXURY_CONDOMINIUM`।

আশা করুন `200`। নতুন টিয়ারের `current` হয় `true`। `amount` নতুন দাম। এই দাম পরের ইনভয়েস থেকে লাগে। মাঝের দিনের জন্য আলাদা চার্জ হয় না।

একই টিয়ার আবার দিলে, `propertyType` ছাড়া, `409` এবং `{ "message": "This plan is already active" }`। একই টিয়ার শুধু `propertyType` বদলাতে চাইলে `200`। `ACTIVE` না হলে `403` এবং `{ "message": "Choose a plan and complete payment before changing it" }`। ভুল আইডিতে `400` এবং `{ "message": "Plan not found" }`।

## 7. Cancel plan

এটা আসল সাবস্ক্রিপশন বন্ধ করে। টেস্টের শেষে চালান।

`POST http://localhost:3000/api/v1/billing/subscription/cancel`

বডি none। আশা করুন `200`।

Stripe সাবস্ক্রিপশন থাকলে স্ট্যাটাস `Active` থাকে `nextBilling` পর্যন্ত। `cancelAtPeriodEnd` হয় `true`, আর `cancelsOn`-এ সেই তারিখ থাকে। তারপর প্ল্যান `Cancelled` হয়। Stripe সাবস্ক্রিপশন না থাকলে সাথে সাথে `Cancelled`।

আবার Cancel চাপলে `409` এবং `{ "message": "This plan is already cancelled" }`।
