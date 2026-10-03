# Два самостоятельных проекта: запуск на Railway

Вам нужны два репозитория/сервиса — frontend и backend — и собственный Supabase-проект.
Никаких ключей или аккаунта облачного редактора приложению не требуется.

## 1. Распакуйте архивы

Внутри архивов папки frontend и backend. Загружайте **содержимое каждой папки**
в корень отдельного GitHub-репозитория: package.json и Dockerfile должны быть в корне.
Не загружайте .env, node_modules или dist. В каждом репозитории свой package-lock.json.
Можно хранить обе папки в одном репозитории, но тогда настройте Root Directory
соответствующего Railway-сервиса на /frontend и /backend.

## 2. Подготовьте Supabase

Если проект уже принадлежит вашему аккаунту — сохраните его и данные. В SQL Editor
выполните backend/database/upgrade-existing.sql.

Для совершенно новой базы выполните backend/database/install-new.sql.
Если нужны старые пользователи/задачи, сначала прочитайте backend/MIGRATION.md:
исходники не содержат рабочую базу, файлы Storage и пароли.

В Supabase Project Settings возьмите URL, anon key и service-role key.
Используйте JWT-ключи из Legacy API keys (anon/service_role) для этой версии шлюза;
не подставляйте management access token или пароль PostgreSQL вместо них.

## 3. Создайте frontend на Railway

В одном Railway Project создайте сервис из frontend-репозитория и назовите его frontend.
Dockerfile и railway.json уже настроены. Добавьте Variables:

```env
BACKEND_URL=http://backend.railway.internal:3001
```

Settings → Networking → Generate Domain. Получите публичный HTTPS-адрес frontend.
Открытие /healthz проверяет frontend без обязательной доступности backend.

## 4. Создайте backend в том же Railway Project и Environment

Создайте второй сервис из backend-репозитория, назовите его backend.
В его Private Networking проверьте фактический адрес: если он отличается от
backend.railway.internal, исправьте BACKEND_URL у frontend.

Variables backend:

```env
PORT=3001
APP_URL=https://ВАШ_FRONTEND.up.railway.app
SUPABASE_URL=https://ВАШ_ПРОЕКТ.supabase.co
SUPABASE_ANON_KEY=ВАШ_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=ВАШ_SERVICE_ROLE_KEY
ALLOW_SIGNUP=false
TELEGRAM_WORKER_ENABLED=false
```

APP_URL — адрес FRONTEND, без пути и завершающего слеша.
Backend PORT здесь фиксируется намеренно: этот порт указан во внутреннем BACKEND_URL.
Frontend использует PORT, предоставленный Railway. NODE_ENV=production задан Dockerfile.
Сервисы слушают IPv4/IPv6, поэтому внутреннее соединение Railway поддерживается.
Backend публичный домен не нужен. На обоих сервисах build/start/health уже заданы
в Dockerfile и railway.json; удалите конфликтующие ручные overrides, если они остались.

Перезапустите deployments после изменения Variables.

## 5. Настройте вход и email

В Supabase Authentication → URL Configuration:

- Site URL: адрес frontend.
- Redirect URLs: адрес frontend и адрес frontend/reset-password.

Для восстановления пароля и подтверждения email настройте Custom SMTP.
Отключите старый Send Email Hook; шесть переносимых шаблонов находятся в
backend/email-templates. Подробные настройки — backend/README.md.

Старые пользователи входят как раньше при сохранённой базе.
Для пустого проекта создайте первого администратора по backend/README.md через
`npm run admin:create` на своём компьютере. Ключи и пароль находятся только в backend .env.
Регистрация может остаться закрытой. Если нужна открытая — ALLOW_SIGNUP=true и
соответствующее разрешение в Supabase Auth; назначение ролей остаётся обязательным.

## 6. Проверьте адрес frontend

- /healthz → {"ok":true,"service":"frontend"}
- /api/health → {"ok":true}
- /api/projects без входа → 401.
- /auth → страница входа.
- /projects и /task/… после входа открываются и при прямом обновлении страницы.

Проверьте два браузера: чаты и обновления статусов через WebSocket.
Проверьте загрузку и просмотр файлов, гайды, настройки, статистику и роли.
Кнопки и страницы сохранены; реальные интеграции проверяются с вашими ключами.

## 7. Подключите Telegram, если используется

В backend задайте TELEGRAM_BOT_TOKEN и TELEGRAM_ADMIN_USER_IDS.
Остановите старый polling/cron/webhook этого бота, затем установите
TELEGRAM_WORKER_ENABLED=true. Оставьте одну реплику backend и отключите его засыпание.
Настройки chat ID остаются в прежнем интерфейсе. Подробности — backend/README.md.

## Локальная разработка

Node.js 22. Два PowerShell-терминала.

В папке backend:

```powershell
Copy-Item .env.example .env
notepad .env
npm ci
npm run dev
```

Заполните три SUPABASE_*; APP_URL=http://localhost:8080; PORT=3001.

В папке frontend:

```powershell
Copy-Item .env.example .env
npm ci
npm run dev
```

Откройте http://localhost:8080. Frontend .env содержит только BACKEND_URL и PORT,
серверные ключи туда копировать нельзя. Все команды выполняются из папки соответствующего package.json.

## Типовые проблемы

| Симптом | Что проверить |
| --- | --- |
| /healthz работает, /api/health возвращает 502 | Backend запущен; BACKEND_URL соответствует Private Networking и PORT=3001; оба сервиса в одном Environment |
| Origin not allowed / 403 | APP_URL точно совпадает с адресом frontend, включая протокол и порт |
| Регистрация отключена | ALLOW_SIGNUP и настройка регистрации в Supabase Auth |
| Доступ не выдан | Пользователю ещё не назначена роль; для пустой базы создайте первого admin |
| relation does not exist / bucket not found | Применена нужная схема/миграция в том Supabase, чей URL указан в backend |
| Письмо не приходит | Custom SMTP, sender domain и отключённый старый Send Email Hook |
| Telegram не отправляет | BotFather token, chat ID, доступ бота; групповые уведомления вне 10–19 откладываются |
| В браузере ошибки JSX от tsc | Проверяйте `npm run typecheck` из корня, а не отдельные .tsx |

Справка: [Railway private networking](https://docs.railway.com/networking/private-networking),
[Railway public networking](https://docs.railway.com/networking/public-networking),
[Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
