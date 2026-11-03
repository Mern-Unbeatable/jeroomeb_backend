# ফিল্ড ওয়ার্ক API — Postman চেক

সার্ভার: `http://localhost:3000`

Postman-এ প্রতিটা বডি **Body → raw → JSON**। অ্যাডমিন রিকোয়েস্টে **Authorization → Bearer Token**। টোকেন না থাকলে `401`।

এই ফ্লো একটা প্রপার্টির চালু চেকলিস্ট থেকে ইনস্পেকশন বানায়। সময় ও স্পেশালিস্ট বদলানো যায়। উত্তর সেভ মানে স্পেশালিস্টের ভিজিট। রিজলভ করলে একটা রিপোর্ট এবং `PENDING` পেআউট তৈরি হয়। পেআউটের টাকা প্রপার্টির কমপেনসেশন টিয়ার থেকে আসে।

## আগে লগইন

`POST http://localhost:3000/api/v1/auth/login`

```json
{
  "email": "admin@amenityops.com",
  "password": "AmenityAdmin#2026"
}
```

`200` এর `token` কপি করে Bearer Token-এ বসান।

টেন্যান্ট না থাকলে আগে একটা বানান।

`POST http://localhost:3000/api/v1/organizations/provision`

```json
{
  "name": "Northstar Communities",
  "admin": {
    "fullName": "Jordan Hale",
    "email": "jordan@northstar.example",
    "phone": "555-0100"
  }
}
```

`201` এর `tenant.id` হলো `organizationId`।

## 1. টিয়ার এবং চেকলিস্টের আইডি

কমপেনসেশন টিয়ার:

`GET http://localhost:3000/api/v1/inspections/options`

`compensationTiers` থেকে একটা `id` নিন। `Tier 2 Premier` এর পেআউট `125`।

চেকলিস্ট:

`GET http://localhost:3000/api/v1/checklists`

যে টেমপ্লেট প্রপার্টিতে বসাবেন, তার `id` নিন।

## 2. প্রপার্টি

`POST http://localhost:3000/api/v1/properties`

```json
{
  "organizationId": "paste-tenant-id",
  "name": "Harbor House",
  "propertyType": "LUXURY_CONDOMINIUM",
  "compensationTierId": "paste-tier-id",
  "checklistTemplateIds": ["paste-checklist-template-id"],
  "checklistsAvailable247": true,
  "scheduledAt": "2026-12-01T15:00:00.000Z"
}
```

`201` এর `property.id` কপি করুন।

`checklistsAvailable247: true` মানে ইনস্পেকশন রিজলভ হলে বোর্ডে নতুন একটা `PENDING` কপি থেকে যায়। `scheduledAt` না দিলে ইনস্পেকশন বানানোর সময় আলাদা সময় পাঠাতে হবে।

## 3. চেকলিস্ট থেকে ইনস্পেকশন

`POST http://localhost:3000/api/v1/inspections`

```json
{
  "propertyId": "paste-property-id"
}
```

কী করে: প্রপার্টির প্রতিটা চালু চেকলিস্টের জন্য একটা `PENDING` ইনস্পেকশন বানায়। সময় না দিলে প্রপার্টির `scheduledAt` নেয়। `specialistId` না দিলে রোস্টারের `PRIMARY` স্পেশালিস্ট থাকলে তাকে বসায়।

আশা করুন `201`। `inspections[0].id` কপি করুন। `status` হবে `PENDING`।

চেকলিস্ট না থাকলে `400` এবং `{ "message": "This property has no checklists enabled" }`। সময় না থাকলে `400` এবং `{ "message": "A scheduled time is required" }`। একই চেকলিস্টের খোলা ইনস্পেকশন আগে থেকে থাকলে `409`।

নিজের সময় বা স্পেশালিস্ট দিতে চাইলে:

```json
{
  "propertyId": "paste-property-id",
  "scheduledAt": "2026-12-01T15:00:00.000Z",
  "specialistId": "paste-profile-id"
}
```

`specialistId` স্পেশালিস্ট প্রোফাইলের আইডি। `GET /api/v1/specialists/applications` এর `profile.id`।

## 4. লিস্ট এবং একটা ইনস্পেকশন

`GET http://localhost:3000/api/v1/inspections`

`GET http://localhost:3000/api/v1/inspections?propertyId=<property-id>`

`GET http://localhost:3000/api/v1/inspections?status=PENDING`

`status` শুধু `PENDING`, `IN_PROGRESS`, `RESOLVED_CLOSED`, `CANCELLED`।

`overdue` হিসাব করা ফিল্ড। সময় পেরিয়ে গেলে এবং স্ট্যাটাস `PENDING` বা `IN_PROGRESS` হলে `true`।

একটা দেখতে:

`GET http://localhost:3000/api/v1/inspections/<inspection-id>`

`items` এর প্রতিটা চেকলিস্ট প্রশ্ন। উত্তর দিতে `items[].id` লাগবে। ভুল আইডি হলে `404`।

## 5. সময় এবং অ্যাসাইনি এডিট

`PATCH http://localhost:3000/api/v1/inspections/<inspection-id>`

```json
{
  "scheduledAt": "2026-12-02T02:00:00.000Z",
  "specialistId": "paste-profile-id"
}
```

অ্যাসাইনি সরাতে `"specialistId": null`। বাতিল বা রিজলভ করা ইনস্পেকশনে `400`।

## 6. উত্তর সেভ — স্পেশালিস্টের ভিজিট

`PUT http://localhost:3000/api/v1/inspections/<inspection-id>/answers`

```json
{
  "answers": [
    {
      "checklistItemId": "paste-item-id",
      "result": "PASS",
      "note": "Gate latched",
      "photoUrl": null,
      "latitude": 40.712776,
      "longitude": -74.005974
    }
  ]
}
```

`result` শুধু `PASS`, `FAIL`, অথবা `NA`।

প্রথম সেভে স্ট্যাটাস `PENDING` থেকে `IN_PROGRESS` হয় এবং `startedAt` বসে। পরের সেভ শুধু উত্তর আপডেট করে।

স্পেশালিস্ট `scheduledAt`-এর আগে উত্তর সেভ করতে পারবে না। `400` এবং `{ "message": "The specialist can't start before the scheduled time" }`। অ্যাডমিন আগে শুরু করতে পারে।

স্পেশালিস্ট শুধু নিজের অ্যাসাইন করা ইনস্পেকশনে ঢুকতে পারে। অন্যজনেরটাতে `403`।

রিজলভের আগে যত `required: true` আইটেম, সবকটার উত্তর লাগবে। বিস্তারিত রেসপন্সের সব `items[].id` দিয়ে একবারে পাঠানোই সহজ।

## 7. বাতিল

`POST http://localhost:3000/api/v1/inspections/<inspection-id>/cancel`

বডি লাগে না। আশা করুন `200` এবং `inspection.status` হবে `CANCELLED`। আগে থেকে বাতিল থাকলে সেই ইনস্পেকশনই ফেরে। রিজলভ করা থাকলে `400`।

## 8. রিজলভ — রিপোর্ট এবং পেআউট

`POST http://localhost:3000/api/v1/inspections/<inspection-id>/resolve`

```json
{
  "summary": "Overnight audit completed. Pool gate and lobby were secure."
}
```

`summary` না দিলেও চলে।

আশা করুন `200`।

- `inspection.status` = `RESOLVED_CLOSED`
- `inspection.report.id` এবং `inspection.report.summary`
- `inspection.payout.status` = `PENDING`
- `inspection.payout.amount` = প্রপার্টির টিয়ারের টাকা
- `checklistsAvailable247` চালু থাকলে `nextInspection.status` = `PENDING`

স্পেশালিস্ট না বসানো থাকলে `400` এবং `{ "message": "Assign a specialist before resolving this inspection" }`। টিয়ার না থাকলে `400` এবং `{ "message": "This property has no compensation tier" }`। বাধ্যতামূলক উত্তর বাকি থাকলে `400` এবং `{ "message": "Required checklist items are still unanswered" }`।

## 9. রিপোর্ট দেখা

`GET http://localhost:3000/api/v1/reports`

`GET http://localhost:3000/api/v1/reports/<report-id>`

পিডিএফ এই ধাপে তৈরি হয় না। `pdfUrl` খালি থাকবে।

## 10. পেআউট দেখা

`GET http://localhost:3000/api/v1/payouts`

`GET http://localhost:3000/api/v1/payouts?status=PENDING`

`GET http://localhost:3000/api/v1/payouts/<payout-id>`

`status` শুধু `PENDING`, `APPROVED`, `PAID`। এই ধাপে পেআউট `PENDING` থাকে। অ্যাপ্রুভ বা পেইড এখানে হয় না।
