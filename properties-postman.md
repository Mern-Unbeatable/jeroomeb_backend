# প্রপার্টি API — কাজ এবং Postman চেক

সার্ভার: `http://localhost:3000`

Postman-এ প্রতিটা বডি **Body → raw → JSON**। অ্যাডমিন রিকোয়েস্টে **Authorization → Bearer Token** দিতে হবে। টোকেন না থাকলে `401`।

এই API গুলো অ্যাডমিনের প্রপার্টি স্ক্রিনের জন্য। `SUPER_ADMIN` অথবা `TEAM_MEMBER` টোকেন লাগে।

## আগে লগইন

`POST http://localhost:3000/api/v1/auth/login`

```json
{
  "email": "admin@amenityops.com",
  "password": "AmenityAdmin#2026"
}
```

`200` এ `token` কপি করে বাকি রিকোয়েস্টের Bearer Token-এ বসান।

প্রপার্টি একটা টেন্যান্টের (কোম্পানির) অধীনে তৈরি হয়। তাই আগে একটা `organizationId` লাগবে।

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

`201` এর `tenant.id` কপি করুন। এটাই `organizationId`।

## 1. লিস্ট

`GET http://localhost:3000/api/v1/properties`

কী করে: সব প্রপার্টি দেয়। নতুনটা আগে। প্রতিটাতে কোড, নাম, টাইপ, স্ট্যাটাস, কোম্পানি, এবং রোস্টার থাকে।

আশা করুন `200` এবং `{ "properties": [ ... ] }`।

## 2. নতুন প্রপার্টি

`POST http://localhost:3000/api/v1/properties`

কী করে: ওই টেন্যান্টের জন্য একটা প্রপার্টি বানায়। কোড নিজে থেকে `PROP-` দিয়ে শুরু হয়, যেমন `PROP-VRCT6Y`।

```json
{
  "organizationId": "paste-tenant-id",
  "name": "Harbor House",
  "propertyType": "RESIDENTIAL_MULTI_TENANT",
  "contactName": "Jordan Hale",
  "email": "jordan@northstar.example",
  "phone": "555-0100",
  "street": "100 Harbor Ave",
  "city": "Miami",
  "state": "FL",
  "zip": "33101",
  "unitCount": 80,
  "buildingCount": 2,
  "status": "DRAFT",
  "latitude": 40.712776,
  "longitude": -74.005974,
  "geofenceEnabled": true,
  "geofenceRadiusMeters": 100,
  "timezone": "America/New_York",
  "photoIdRequired": true,
  "checklistsAvailable247": true,
  "scheduledAt": "2026-10-03T09:01:00.000Z",
  "checklistTemplateIds": ["paste-checklist-template-id"],
  "inspectionDays": ["MONDAY", "THURSDAY"]
}
```

`propertyType` এই চারটার একটা:

- `RESIDENTIAL_MULTI_TENANT`
- `COMMERCIAL`
- `ACTIVE_ADULT_55`
- `LUXURY_CONDOMINIUM`

`status` না দিলে `DRAFT`। `ACTIVE` অথবা `INACTIVE`ও দেওয়া যায়।

চেকলিস্টের আইডি আগে নিন:

`GET http://localhost:3000/api/v1/checklists`

এখানে তিনটা টেমপ্লেট আসে: 55+ Active Adult, Luxury Condominium, এবং Commercial Multi-Tenant। যেগুলো প্রপার্টিতে দিতে চান, সেই `id` গুলো `checklistTemplateIds`-এ দিন।

`checklistsAvailable247: true` মানে Available 24/7। স্পেশালিস্ট চেকলিস্ট জমা দিলে বোর্ডে নতুন একটা পেন্ডিং কপি থাকে।

`scheduledAt` হলো Scheduled date & time। UTC সময় দিন। খালি রাখলে স্পেশালিস্ট যেকোনো সময় শুরু করতে পারে। `photoIdRequired: true` মানে ড্রাইভিং লাইসেন্স আইডি লাগবে। `timezone` Eastern Time-এর জন্য `America/New_York`।

আশা করুন `201`। `property.id` এবং `property.code` কপি করুন।

টেন্যান্টের প্রপার্টি লিমিট পূর্ণ থাকলে `409` এবং `{ "message": "This tenant has reached its property limit" }`। ভুল `organizationId` হলে `404`।

## 3. একটা প্রপার্টি দেখা

`GET http://localhost:3000/api/v1/properties/<property-id>`

কী করে: একটা প্রপার্টির ঠিকানা, ইনস্পেকশন দিন, কমপেনসেশন টিয়ার, এবং রোস্টার দেয়।

আশা করুন `200`। ভুল আইডি হলে `404`।

## 4. এডিট

`PATCH http://localhost:3000/api/v1/properties/<property-id>`

কী করে: যে ফিল্ড পাঠানো হয় শুধু সেগুলো বদলায়। `status` আগের চেয়ে অন্য হলে একটা `ActivityEvent` লেখা হয়। যেমন `PROP-VRCT6Y marked ACTIVE`।

```json
{
  "status": "ACTIVE",
  "unitCount": 90
}
```

আশা করুন `200` এবং `property.status` হবে `ACTIVE`।

## 5. রোস্টারে স্পেশালিস্ট

কী করে: এই প্রপার্টিতে একজন স্পেশালিস্টকে PRIMARY, BACKUP, অথবা IN_HOUSE হিসেবে বসায়। একই স্পেশালিস্ট আবার পাঠালে অ্যাসাইনমেন্ট আপডেট হয়।

`specialistId` হলো স্পেশালিস্ট **প্রোফাইলের** আইডি, ইউজার আইডি না।

আগে লিস্ট থেকে নিন:

`GET http://localhost:3000/api/v1/specialists/applications`

`profile.id` কপি করুন। লিস্ট খালি থাকলে আগে `POST /api/v1/specialists/applications` দিয়ে একটা আবেদন তৈরি করুন। সেই রিকোয়েস্টে Bearer Token লাগবে না। রেসপন্সের `profile.id` ব্যবহার করুন।

তারপর:

`POST http://localhost:3000/api/v1/properties/<property-id>/roster`

```json
{
  "specialistId": "paste-profile-id",
  "assignment": "PRIMARY"
}
```

`assignment` শুধু `PRIMARY`, `BACKUP`, অথবা `IN_HOUSE`।

আশা করুন `201`। `roster.id` কপি করুন। স্পেশালিস্ট না থাকলে `404`।

সরাতে:

`DELETE http://localhost:3000/api/v1/properties/<property-id>/roster/<roster-id>`

আশা করুন `200` এবং `{ "message": "Roster assignment removed" }`।

## 6. ডিলিট

`DELETE http://localhost:3000/api/v1/properties/<property-id>`

কী করে: প্রপার্টি মুছে দেয়। তার রোস্টার এবং ইনস্পেকশন দিনও চলে যায়।

আশা করুন `200` এবং `{ "message": "Property deleted" }`।

প্রপার্টি কোনো সার্ভিস রিকোয়েস্ট বা ইনস্পেকশনের সাথে বাঁধা থাকলে `409` এবং `{ "message": "This property is in use" }`। ভুল আইডি হলে `404`।
