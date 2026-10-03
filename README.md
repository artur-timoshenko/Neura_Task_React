# Neura Task Hub — Frontend

Самостоятельный React + TypeScript + Vite проект. Все страницы, JSX, CSS, изображения,
анимации, RU/EN, маршруты и компоненты интерфейса перенесены из предыдущей версии.
Серверная бизнес-логика находится в отдельном backend-архиве.

Начните с `START-HERE.md`: это инструкция запуска двух сервисов на Railway.

## Локальный запуск

Node.js 22. Откройте PowerShell в этой папке:

```powershell
Copy-Item .env.example .env
npm ci
npm run dev
```

В .env по умолчанию BACKEND_URL=http://127.0.0.1:3001.
В отдельном терминале должен работать backend с APP_URL=http://localhost:8080.
Открывайте http://localhost:8080. Backend самостоятельно проверяет права.

Production-сборка и запуск:

```powershell
npm run check
npm run build
npm start
```

npm start читает .env и раздаёт dist на PORT (по умолчанию 8080).
`npm run preview` также собирает проект и запускает полноценный hosting с /api.

## Связь с backend

Браузер использует /api на том же домене. Vite в разработке и hosting в production
передают запросы в BACKEND_URL, включая WebSocket, multipart-загрузки и скачивание файлов.
Поэтому URL API не зашит в собранный JS: смена backend не требует пересборки React.

`hosting/` — только раздача статики и reverse proxy к одному адресу из окружения.
Здесь нет ролей, доступа к базе, паролей, почты или Telegram. Это инфраструктура
доставки frontend, позволяющая избежать CORS и раздельных браузерных сессий.
Backend — самостоятельный сервис и отдельная кодовая база.

В Variables frontend нужны только BACKEND_URL и необязательный PORT.
Не добавляйте SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN или секреты с префиксом VITE_.
SUPABASE_URL и реальные Supabase API keys также не нужны frontend.

## Структура

- src/pages, src/components — прежние страницы и визуальные компоненты.
- src/contexts — язык, состояние входа и отображаемая роль.
- src/integrations/supabase — клиент протокола /api, типы ответа; без ключей базы.
- hosting — статическая раздача, SPA fallback, reverse proxy и WebSocket.
- public — локальные публичные ресурсы и social preview.
- test — проверка hosting; src/test — проверки frontend.

Проверка TypeScript — `npm run typecheck` из корня проекта.
Не передавайте отдельные .tsx-файлы в tsc: это игнорирует tsconfig и вызывает ошибки JSX/алиасов.

Изменения служебного кода: удалён мост авторизации для облачного редактора;
метаданные сайта и social preview больше не используют его домены;
исправлено добавление служебного суффикса к пути файла в гайдах.
Исходные компоненты и CSS не переписывались.
