# Bot — Temur PUBGM (bot/)

Telegram bot panel. **grammY** kutubxonasi asosida (Telegraf'ning zamonaviy davomchisi). Node.js + ES Modules.

## Domen va asosiy foydalanuvchi

**Temur PUBGM** — PUBG Mobile turnirlari platformasi. Bot asosan **`player`** rolidagi foydalanuvchilar uchun ishlaydi (web panel emas, Telegram interfeysi).

Tipik player flow:
1. `/start` → ro'yxatdan o'tish (PUBG ID, in-game nickname, telefon).
2. Mavjud turnirlarni ko'rish, ro'yxatdan o'tish.
3. Komandasi (agar leader qo'shgan bo'lsa) va statusni ko'rish.
4. Turnir boshlanishidan oldin room ID + parolni qabul qilish.
5. Natijalar va o'z statistikasini ko'rish.

Leader/admin uchun ham yengil komandalar bo'lishi mumkin (xabarnoma, tasdiqlash), lekin to'liq boshqaruv — frontend panellarda.

## Folder structure

```
bot/src/
├─ index.js                  # entrypoint: bot init + start
├─ config/
│  ├─ env.js                 # process.env validation
│  └─ logger.js              # pino logger
├─ handlers/                 # bitta fayl = bitta update handler
│  ├─ start.handler.js
│  └─ help.handler.js
├─ middlewares/              # bot.use(...) middleware'lar
│  └─ errorHandler.js
├─ keyboards/                # Keyboard / InlineKeyboard builderlar
│  └─ main.keyboard.js
└─ services/                 # tashqi resurslar (server API, ...)
   └─ api.service.js
```

## Asosiy qoidalar

1. **Til**: foydalanuvchiga matn — o'zbek tilida. Kod nomlari — ingliz tilida.
2. **Handler** — bitta endpoint = bitta fayl (`handlers/<name>.handler.js`). Faqat `ctx`ni qabul qiladi.
3. **Servis** — backend API'ga so'rovlar `services/api.service.js` orqali (axios instance, `API_BASE_URL` env'dan).
4. **Keyboard** — `keyboards/<name>.keyboard.js`, ko'p joyda qayta ishlatish uchun.
5. **Logger** — `console.log` ishlatilmaydi, `logger` import qilinadi.
6. **Error** — `bot.catch(errorHandler)` orqali markazlashtirilgan.

## grammY tanlanganining sababi

- ES Module-first, zamonaviy API.
- TypeScript yaxshi qo'llanadi.
- `@grammyjs/runner` — yuqori yuklamaga chidamli (concurrent updates).
- `@grammyjs/conversations` — ko'p qadamli scenariy (state machine).
- Telegraf'dan kichikroq bundle va faolroq develop.

## Commands

```bash
npm run dev      # nodemon
npm start
```

## Env

```env
NODE_ENV=development
BOT_TOKEN=<telegram bot token>
API_BASE_URL=http://localhost:5000/api
```
