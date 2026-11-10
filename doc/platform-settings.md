# প্ল্যাটফর্ম সেটিংস — Postman চেক

সার্ভার: `http://localhost:3000`

বডি **Body → raw → JSON**। **Authorization → Bearer Token** দিন। শুধু সুপার অ্যাডমিন। টিম মেম্বার বা ক্লায়েন্ট `403` এবং `{ "message": "You do not have access to this" }`। টোকেন না দিলে `401`।

এই দাম ক্লায়েন্টের চেকআউট দাম নয়। Full-Service ক্লায়েন্ট এখনও Tier 1 `$115`, Tier 2 `$170`, Tier 3 `$225` দেখে। Software Only ক্লায়েন্ট এখনও `$299`, `$449`, এবং Contact Us দেখে। Essential, Growth, Enterprise লাইসেন্স প্ল্যানও আলাদা থাকে।

## 1. সুপার অ্যাডমিন লগইন

`POST http://localhost:3000/api/v1/auth/login`

```json
{
  "email": "admin@amenityops.com",
  "password": "AmenityAdmin#2026"
}
```

`token` কপি করে Bearer Token-এ বসান।

## 2. প্রাইসিং দেখা

`GET http://localhost:3000/api/v1/settings/pricing`

বডি none। আশা করুন `200`।

`fullService.propertyTypes` তিনটা সারি, এই ক্রমে:

| প্রপার্টি টাইপ | Tier 1 | Tier 2 | Tier 3 |
| --- | --- | --- | --- |
| Luxury Condominium | `1995.00` | `2395.00` | `2895.00` |
| 55+ Active Adult Community | `1795.00` | `2295.00` | `2795.00` |
| Commercial Multi-Tenant | `2095.00` | `2595.00` | `3195.00` |

`propertyType` কোড: `LUXURY_CONDOMINIUM`, `ACTIVE_ADULT_55`, `COMMERCIAL`। `fullService.note` হয় `Configurable demo values—not confirmed production pricing.`

`software.plans`:

- Tier 1 — Baseline, `$299.00`, `propertyCapacity` `1`, `billingFrequency` `MONTHLY`, `active` `true`
- Tier 2 — Premier, `$749.00`
- Tier 3 — Sovereign, `$1499.00`

`software.note` হয় `Standard / Pro / Enterprise tenant provisioning labels remain separate from these software pricing plan names.`

## 3. Full-Service দাম সেভ

একটা ঘর, অথবা পুরো ম্যাট্রিক্স। `propertyType`-এ কোড বা লেবেল দুটোই চলে।

`PUT http://localhost:3000/api/v1/settings/pricing/full-service`

```json
{
  "prices": [
    { "propertyType": "Luxury Condominium", "tier": 1, "amount": 2000 },
    { "propertyType": "55+ Active Adult Community", "tier": 2, "amount": 2300 },
    { "propertyType": "Commercial Multi-Tenant", "tier": 3, "amount": 3200 }
  ]
}
```

আশা করুন `200`। যে ঘর পাঠানো হয়নি, সেটার দাম আগের মতো থাকে। পাঠানো ঘর `"2000.00"` দেখায়। একই ঘর দুবার দিলে `400` এবং `{ "message": "Each property type and tier can be saved once" }`। অজানা প্রপার্টি টাইপে `400`।

## 4. Restore Saved Values

শুধু Full-Service ম্যাট্রিক্স স্ক্রিনের ডিফল্টে ফিরে যায়। Software Only কার্ড বদলায় না।

`POST http://localhost:3000/api/v1/settings/pricing/full-service/restore`

বডি none। আশা করুন `200`। Luxury Condominium Tier 1 আবার `"1995.00"`।

## 5. Software Only সেভ

`PUT http://localhost:3000/api/v1/settings/pricing/software`

```json
{
  "plans": [
    {
      "tier": 1,
      "monthlyPrice": 299,
      "propertyCapacity": 5,
      "billingFrequency": "Monthly",
      "active": true
    },
    {
      "tier": 2,
      "monthlyPrice": 749,
      "propertyCapacity": 15,
      "billingFrequency": "MONTHLY",
      "active": true
    },
    {
      "tier": 3,
      "monthlyPrice": 1499,
      "propertyCapacity": 40,
      "billingFrequency": "Monthly",
      "active": false
    }
  ]
}
```

আশা করুন `200`। `billingFrequency` সেভ হয় `MONTHLY`। `Monthly` বা `MONTHLY` দুটোই চলে। অন্য ফ্রিকোয়েন্সিতে `400` এবং `{ "message": "Billing frequency must be monthly" }`। একই টিয়ার দুবার দিলে `400` এবং `{ "message": "Each tier can be saved once" }`।

টেস্টের পর Tier 3 আবার চালু রাখতে একই রিকোয়েস্টে `"active": true` এবং ক্যাপাসিটি `1` দিয়ে সেভ করুন।
