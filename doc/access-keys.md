# Access & Keys — Postman চেক

সার্ভার: `http://localhost:3000`

বডি **Body → raw → JSON**। যেখানে টোকেন লাগে, **Authorization → Bearer Token** দিন।

`FULL_SERVICE` এবং `ACTIVE` ক্লায়েন্ট নিজের প্রপার্টির অ্যাক্সেস তথ্য সেভ করে। সুপার অ্যাডমিন সব ক্লায়েন্টের তথ্য দেখে। এক প্রপার্টিতে একটা রেকর্ড। Software Only বা পেমেন্ট শেষ না হওয়া অ্যাকাউন্ট সেভ করতে পারে না।

## 1. অ্যাডমিন লগইন

`POST http://localhost:3000/api/v1/auth/login`

```json
{
  "email": "admin@amenityops.com",
  "password": "AmenityAdmin#2026"
}
```

`token` কপি করে অ্যাডমিন রিকোয়েস্টের Bearer Token-এ বসান।

## 2. ক্লায়েন্ট লগইন

`FULL_SERVICE` এবং `ACTIVE` ক্লায়েন্টের ইমেইল-পাসওয়ার্ড দিয়ে একই লগইন API। `token` আলাদা রেখে ক্লায়েন্ট রিকোয়েস্টে ব্যবহার করুন।

## 3. ক্লায়েন্ট অ্যাক্সেস যোগ

ক্লায়েন্ট টোকেন। `propertyId` দিতে হয় না। সার্ভার ক্লায়েন্টের প্রপার্টিতে সেভ করে।

`POST http://localhost:3000/api/v1/access-keys`

```json
{
  "mainEntryInstructions": "Use the south entrance on Market Street. Keypad access via the lobby intercom panel.",
  "buildingAccessCode": "101250",
  "elevatorAccess": "Elevator bank B (freight elevator for after-hours use). Access card required for floors 2-14.",
  "lockboxCode": "205896",
  "emergencyContactName": "Carlos Reyes",
  "emergencyContactTitle": "Building Manager",
  "emergencyContactPhone": "(415) 304-1188",
  "additionalNotes": "After 11 PM, use the freight entrance on Mission Street. Alert building security via intercom before entry."
}
```

আশা করুন `201`। `accessKey.id` কপি করুন। `emergencyContact` অবজেক্টে নাম, টাইটেল এবং ফোন আসে। `property.address`-এ ঠিকানা এক লাইনে আসে।

কমপক্ষে একটা ডিটেইল দিতে হবে। খালি বডি হলে `400`। প্রপার্টি না থাকলে `404` এবং `{ "message": "Property not found" }`। আবার যোগ করলে `409` এবং `{ "message": "Access keys already exist" }`।

Software Only বা `UNPAID` অ্যাকাউন্টে `403` এবং `{ "message": "Access keys are available on an active Service + Software plan" }`। অ্যাডমিন এই POST করলে `403`। টোকেন না দিলে `401`।

## 4. ক্লায়েন্ট নিজের লিস্ট

ক্লায়েন্ট টোকেন:

`GET http://localhost:3000/api/v1/access-keys`

আশা করুন `200`। `accessKeys`-এ শুধু এই ক্লায়েন্টের প্রপার্টি। কিছু না সেভ করলে অ্যারে খালি।

একটা দেখতে:

`GET http://localhost:3000/api/v1/access-keys/<access-key-id>`

অন্য ক্লায়েন্টের আইডি দিলে `403`।

## 5. সুপার অ্যাডমিন সব দেখে

অ্যাডমিন টোকেন:

`GET http://localhost:3000/api/v1/access-keys`

আশা করুন `200`। সব ক্লায়েন্টের অ্যাক্সেস তথ্য আসে। `property.company.name`-এ কোম্পানির নাম থাকে।

একটা রেকর্ড:

`GET http://localhost:3000/api/v1/access-keys/<access-key-id>`

`buildingAccessCode` এবং `lockboxCode` পুরো কোড হিসেবে আসে।

## 6. ক্লায়েন্ট আপডেট

ক্লায়েন্ট টোকেন। যে ফিল্ড দেবেন শুধু সেটা বদলায়।

`PATCH http://localhost:3000/api/v1/access-keys/<access-key-id>`

```json
{
  "buildingAccessCode": "101251",
  "additionalNotes": "After 11 PM, call the building manager before entry."
}
```

আশা করুন `200`। একটা ফিল্ড মুছতে `null` দিন, যেমন `{ "lockboxCode": null }`। খালি বডি হলে `400`। অন্য ক্লায়েন্টের রেকর্ডে `403`। অ্যাডমিন PATCH করলে `403`।
