# অ্যাড-অন সার্ভিস — Postman চেক

সার্ভার: `http://localhost:3000`

বডি **Body → raw → JSON**। অ্যাডমিন এবং ক্লায়েন্ট রিকোয়েস্টে **Authorization → Bearer Token** দিন।

অ্যাডমিন নতুন অ্যাড-অন তৈরি, দাম বদল, এবং ডিলিট করতে পারে। `FULL_SERVICE` (Service + Software) ক্লায়েন্ট সেই অ্যাড-অন রিকোয়েস্ট করে। রিকোয়েস্ট অ্যাডমিনের সার্ভিস কিউতে `Pending Review` হয়। অ্যাডমিন `Approved` করলে ক্লায়েন্টের ড্যাশবোর্ডে `Active` হয়ে দেখায়।

## 1. অ্যাডমিন লগইন

`POST http://localhost:3000/api/v1/auth/login`

```json
{
  "email": "admin@amenityops.com",
  "password": "AmenityAdmin#2026"
}
```

`token` কপি করে অ্যাডমিন রিকোয়েস্টের Bearer Token-এ বসান।

## 2. অ্যাড-অন লিস্ট

`GET http://localhost:3000/api/v1/add-on-services`

অ্যাডমিন এবং ক্লায়েন্ট (`CLIENT`, `TENANT_ADMIN`) দুজনেই এই লিস্ট পায়। টোকেন লাগে। আশা করুন `200`। মেইন সার্ভিস এই লিস্টে আসে না। ক্লায়েন্ট শুধু `active` অ্যাড-অন দেখে। অ্যাডমিন বন্ধ করা অ্যাড-অনও দেখে।

## 3. নতুন অ্যাড-অন

`POST http://localhost:3000/api/v1/add-on-services`

```json
{
  "name": "Apex Crest Properties LLC",
  "description": "Overnight coverage for the Apex Crest portfolio.",
  "price": 70
}
```

`description` না দিলেও চলে। আশা করুন `201` এবং `addOn.id`। একই নাম আবার দিলে `409`।

## 4. দাম বা ডিটেইলস বদলানো

`PATCH http://localhost:3000/api/v1/add-on-services/<add-on-id>`

```json
{
  "price": 80,
  "description": "Updated overnight coverage."
}
```

যে ফিল্ড দেবেন শুধু সেটা বদলায়। `active: false` করলে ক্লায়েন্টের Available তালিকা থেকে নাম সরে যায়। ভুল আইডি হলে `404`।

## 5. ডিলিট

`DELETE http://localhost:3000/api/v1/add-on-services/<add-on-id>`

আশা করুন `200` এবং `{ "message": "Add-on deleted" }`। কোনো রিকোয়েস্টে এই অ্যাড-অন লাগানো থাকলে `409` এবং `{ "message": "This add-on is in use" }`।

## 6. ক্লায়েন্ট রিকোয়েস্ট

ক্লায়েন্টের অ্যাকাউন্ট `ACTIVE` এবং প্ল্যান `FULL_SERVICE` হতে হবে। নাহলে `403` এবং `{ "message": "Add-ons are available on an active Service + Software plan" }`।

ক্লায়েন্ট টোকেন দিয়ে:

`POST http://localhost:3000/api/v1/service-requests/add-on`

```json
{
  "addOnServiceId": "paste-add-on-id"
}
```

আশা করুন `201`। `url` ব্রাউজারে খুলুন এবং টেস্ট কার্ড `4242 4242 4242 4242` দিয়ে পেমেন্ট করুন। `sessionId` কপি করুন। পেমেন্টের আগে অ্যাডমিনের কিউতে কিছু যায় না।

পেমেন্ট নিশ্চিত:

`POST http://localhost:3000/api/v1/service-requests/add-on/confirm`

```json
{
  "sessionId": "paste-session-id"
}
```

স্ট্রাইপ `paid` বললে তবেই রিকোয়েস্ট তৈরি হয়। `serviceRequest.status` হবে `Pending Review`। না দিয়ে কনফার্ম করলে `400` এবং `{ "message": "Payment is not complete" }`। একই অ্যাড-অন আবার কিনলে `409`।

## 7. অ্যাডমিন কিউ

অ্যাডমিন টোকেনে ফিরে:

`GET http://localhost:3000/api/v1/service-requests?status=Pending Review`

নতুন রো-এর `requestedService.name` হবে সেই অ্যাড-অনের নাম।

ক্লায়েন্ট নিজের সব রিকোয়েস্ট দেখতে পারে:

`GET http://localhost:3000/api/v1/service-requests`

ক্লায়েন্ট টোকেন দিন। আশা করুন `200`। `requests`-এ শুধু এই ক্লায়েন্টের রিকোয়েস্ট থাকে। `counts`ও শুধু ওই রিকোয়েস্টগুলোর। অন্য কাস্টমারের রিকোয়েস্ট আসে না। অ্যাডমিন একই URL-এ পুরো কিউ দেখে।

ক্লায়েন্ট নিজের একটা রিকোয়েস্ট দেখতে পারে:

`GET http://localhost:3000/api/v1/service-requests/<request-id>`

ক্লায়েন্ট টোকেন দিন। আশা করুন `200`। অন্য ক্লায়েন্টের রিকোয়েস্টে `403`।

অ্যাপ্রুভ:

`PATCH http://localhost:3000/api/v1/service-requests/<request-id>/status`

```json
{
  "status": "Approved"
}
```

আশা করুন `200` এবং `status` হবে `Approved`।

## 8. ক্লায়েন্ট ড্যাশবোর্ড

ক্লায়েন্ট টোকেনে:

`GET http://localhost:3000/api/v1/dashboard`

অ্যাপ্রুভের আগে অ্যাড-অন `pendingAddOns`-এ থাকে, `status` হয় `Pending Review`। `services`-এ থাকে না।

অ্যাপ্রুভের পর:

- `services` তালিকায় অ্যাড-অনের `status` হয় `Active`
- `cards.activeServices` বাড়ে
- `availableAddOns`-এ শুধু যেগুলো এখনো কেনা বা রিকোয়েস্ট করা হয়নি
- `plan.kind` হয় `FULL_SERVICE`
