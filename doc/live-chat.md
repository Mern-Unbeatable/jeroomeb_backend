# লাইভ চ্যাট — Postman চেক

সার্ভার: `http://localhost:3000`

বডি **Body → raw → JSON**। যেখানে টোকেন লাগে, **Authorization → Bearer Token** দিন।

চ্যাট শুধু সুপার অ্যাডমিন এবং যে ক্লায়েন্ট Service + Software (`FULL_SERVICE`) কিনে অ্যাকাউন্ট `ACTIVE` করেছে। প্রতি কোম্পানির একটা থ্রেড। ক্লায়েন্ট শুধু নিজের থ্রেড দেখে। সুপার অ্যাডমিন সব যোগ্য কোম্পানির থ্রেড দেখে। Software Only, বা পেমেন্ট শেষ না হওয়া অ্যাকাউন্ট চ্যাট পায় না।

Postman দিয়ে মেসেজ পাঠানো এবং আগের মেসেজ পড়া যায়। নতুন মেসেজ সাথে সাথে পৌঁছাতে ফ্রন্টএন্ড Socket.io ব্যবহার করে। সেটার ইভেন্ট নিচে আছে।

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

Software Only বা `UNPAID` অ্যাকাউন্ট দিলে চ্যাট `403` এবং `{ "message": "Chat is available on an active Service + Software plan" }`।

## 3. ক্লায়েন্ট নিজের থ্রেড

ক্লায়েন্ট টোকেন:

`GET http://localhost:3000/api/v1/chats`

আশা করুন `200`। `chats` অ্যারেতে একটা আইটেম। `chats[0].id` কপি করুন। প্রথমবার `lastMessage` হয় `null`।

টোকেন না দিলে `401`। স্পেশালিস্ট বা টিম মেম্বার কল করলে `403`।

## 4. অ্যাডমিন সব থ্রেড

অ্যাডমিন টোকেন:

`GET http://localhost:3000/api/v1/chats`

আশা করুন `200`। `chats`-এ প্রতিটা `ACTIVE` `FULL_SERVICE` কোম্পানি। প্রতিটা আইটেমে `company.name` এবং `lastMessage`।

## 5. ক্লায়েন্ট মেসেজ পাঠানো

ক্লায়েন্ট টোকেন:

`POST http://localhost:3000/api/v1/chats/<chat-id>/messages`

```json
{
  "body": "The lobby door is sticking after 10pm."
}
```

আশা করুন `201`। `message.sender.role` হবে `CLIENT`। খালি বডি হলে `400`। অন্য কোম্পানির `chat-id` দিলে `403`।

## 6. অ্যাডমিন মেসেজ পড়া

অ্যাডমিন টোকেন:

`GET http://localhost:3000/api/v1/chats/<chat-id>/messages`

আশা করুন `200`। `messages` পুরনো থেকে নতুন। শেষের ৫০টা আসে। আরও পুরনো পেতে:

`GET http://localhost:3000/api/v1/chats/<chat-id>/messages?limit=20&before=<message-id>`

`before` হলো যে মেসেজের আগেরগুলো চান, সেই মেসেজের `id`।

## 7. অ্যাডমিন উত্তর

অ্যাডমিন টোকেন:

`POST http://localhost:3000/api/v1/chats/<chat-id>/messages`

```json
{
  "body": "A specialist will check the lobby door tonight."
}
```

আশা করুন `201`। `message.sender.role` হবে `SUPER_ADMIN`।

ক্লায়েন্ট টোকেনে আবার `GET .../messages` করলে দুটো মেসেজই আসে।

## 8. অ্যাডমিন চ্যাট ডিলিট

শুধু সুপার অ্যাডমিন। ক্লায়েন্ট কল করলে `403`।

`DELETE http://localhost:3000/api/v1/chats/<chat-id>`

বডি লাগে না। আশা করুন `200` এবং `{ "message": "Chat deleted" }`। সেই থ্রেডের সব মেসেজ মুছে যায়। ভুল আইডি হলে `404`।

পরে `GET /api/v1/chats` করলে ওই কোম্পানির খালি থ্রেড আবার তৈরি হয়। আগের মেসেজ থাকে না।

## 9. ফ্রন্টএন্ডে লাইভ

Socket.io একই হোস্টে, `http://localhost:3000`। কানেক্ট করার সময় JWT দিন:

```js
auth: { token: "<jwt>" }
```

- ক্লায়েন্ট কানেক্ট হলে `chat:ready` আসে, `{ chatId }`।
- অ্যাডমিন একটা থ্রেড খুললে `chat:join` পাঠান, `{ chatId }`। সার্ভার `chat:joined` দেয়।
- কেউ মেসেজ পাঠালে দুই পাশে `chat:message` আসে: `{ chatId, message }`। পাঠানোর পক্ষও এই ইভেন্ট পায়।
- অ্যাডমিন চ্যাট ডিলিট করলে `chat:deleted` আসে: `{ chatId }`।
- প্ল্যান না মিললে `chat:error` আসে, তারপর সকেট বন্ধ হয়।
