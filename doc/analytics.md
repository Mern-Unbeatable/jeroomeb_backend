# Analytics — Postman চেক

সার্ভার: `http://localhost:3000`

শুধু সুপার অ্যাডমিন। **Authorization → Bearer Token** দিন। বডি none। Params ট্যাব খালি রাখুন। টোকেন না দিলে `401`। টিম মেম্বার বা ক্লায়েন্ট `403` এবং `{ "message": "You do not have access to this" }`।

নতুন টেবিল নেই। প্রপার্টি আর ইনস্পেকশন ডাটাবেস থেকে আসে। টাকা Stripe-এর paid invoice থেকে আসে। সংখ্যা স্ক্রিনশটের সাথে মিলবে না — লাইভ ডাটা দেখাবে।

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

## 2. Analytics পেজ

`GET http://localhost:3000/api/v1/analytics`

বডি none। আশা করুন `200`।

`cards` আটটা কার্ড:

| কী | স্ক্রিনে | কী দেখবেন |
| --- | --- | --- |
| `totalProperties` | Total Properties | `value` সংখ্যা। `changePercent` এই মাসের আগে যে কয়টা প্রপার্টি ছিল, তার সাথে তুলনা। আগের সংখ্যা `0` হলে `changePercent` হয় `null`। |
| `pendingProperties` | Pending Properties | রোস্টারে কাউকে অ্যাসাইন করা হয়নি। শুধু `value`। |
| `inspectionsInProgress` | Inspections In Progress | `value` হল `IN_PROGRESS`। `activeRightNow` মানে কাজ শুরু হয়েছে (`startedAt` আছে)। |
| `totalRevenue` | Total Revenue | গত ১২ মাসের paid invoice, ডলার স্ট্রিং যেমন `"6587.90"`। `changePercent` তার আগের ১২ মাসের সাথে। আগের বছরের টাকা `0` হলে `null`। |
| `revenueThisMonth` | Revenue This Month | এই মাস। `month` হল `Jan` … `Nov`। `changePercent` আগের ক্যালেন্ডার মাসের সাথে। |
| `fullServiceRevenue` | Full-Service Revenue | এই মাসের সাবস্ক্রিপশন, যে কাস্টমারের `planKind` `FULL_SERVICE`। `sharePercent` এই মাসের মোটের শতাংশ। |
| `softwareRevenue` | Software-Only Revenue | এই মাসের সাবস্ক্রিপশন, `planKind` `SOFTWARE`। |
| `addOnRevenue` | Add-On Service | সাবস্ক্রিপশন নয় এমন paid invoice। |

`revenue.months` ঠিক ১২টা সারি, পুরনো মাস আগে। প্রতি সারিতে `month` (`2026-11`), `label` (`Nov`), `fullService`, `software`। চার্টে অ্যাড-অন নেই।

`inspections` ডোনাট, গত ১২ মাসে `scheduledAt` যেগুলোর:

- `total`
- `resolvedPercent` — Completed ÷ total
- `completed` — `RESOLVED_CLOSED`
- `inProgress` — `IN_PROGRESS`
- `pending` — `PENDING`
- `cancelled` — `CANCELLED`

তিন ভাগের `sharePercent` সবসময় ১০০ হয় না। যে সাবস্ক্রিপশন ইনভয়েসের কাস্টমার কোনো অর্গানাইজেশনের সাথে মিলে না, সেই টাকা মোটের ভিতরে থাকে, নাম করা বালতিতে যায় না।

## 3. CSV এক্সপোর্ট

`GET http://localhost:3000/api/v1/analytics/export`

বডি none। একই Bearer। আশা করুন `200`।

- `Content-Type`: `text/csv; charset=utf-8`
- `Content-Disposition`: `attachment; filename="analytics.csv"`

Postman-এ **Send and Download** চাপুন। ফাইলের প্রথম লাইন:

```text
Metric,Value,Change,Share,Month
```

তারপর কার্ডের সারি, একটা ফাঁকা লাইন, তারপর:

```text
Month,Full Service,Software Only
```

এবং ১২ মাসের চার্ট।

## 4. টোকেন ছাড়া

Bearer সরিয়ে আবার `GET /api/v1/analytics`। আশা করুন `401`।

## 5. ক্লায়েন্ট টোকেন

ক্লায়েন্ট বা টেন্যান্ট অ্যাডমিনের `token` দিয়ে একই GET। আশা করুন `403` এবং `{ "message": "You do not have access to this" }`।
