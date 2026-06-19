# Деплой без потери прогресса игроков

## Почему «всё скинулось»

Вся игра хранится в **одном файле SQLite** — `users.db`:

- аккаунты и пароли;
- прогресс работ (`work_*` в `users`);
- задания (`main_quests`, `daily_quests`);
- герой дня (`hero_of_day_state`, `hero_of_day_daily`, `rep_earnings`);
- стадион, паб, район, фирмы, события.

Файл **не в git** (`.gitignore`). При обновлении через `scp` чаще всего происходит одно из:

1. **Удалили старую папку проекта** (`rm -rf`) — вместе с ней исчез `users.db`.
2. **Скопировали проект с компьютера разработчика** — локальный пустой/тестовый `users.db` **перезаписал** боевую базу.
3. **Сервер запустили из другой копии проекта** — создался новый пустой `users.db` рядом с новым `server.js`.

Игроки видят «надо регистрироваться заново» — это **новая пустая база**, а не сброс в коде.

**Также (без смены файла БД):** после обновления auth часть игроков не смогла войти по нику и создала **второй аккаунт** с тем же ником; старый прогресс остался под старым `email`. См. раздел «Авторизация».

## Localhost vs production

| | Localhost | Production |
|---|-----------|------------|
| База | `users.db` рядом с проектом | `DB_PATH=/var/lib/fanaty/users.db` |
| Игроки | тестовые | боевые |
| Деплой | не трогать prod-базу | **единственный источник истины** |

Локальная база **никогда** не заменяет production.

## Автоматическая проверка перед деплоем

```bash
# На production (или на копии users.db):
DB_PATH=/var/lib/fanaty/users.db node scripts/pre-deploy-check.js

# После успешного prod-состояния — сохранить эталон для сравнения:
DB_PATH=/var/lib/fanaty/users.db node scripts/pre-deploy-check.js --save-baseline
```

Скрипт (только чтение) проверяет:

- количество игроков в `users` и с ником;
- дубликаты ников и пары «старый email + новый @internal.local»;
- аккаунты без ника;
- героя дня (`hero_of_day_state`);
- сообщения в `pub_chat`;
- ближайшие матчи стадиона;
- предупреждение, если `STADIUM_TEST_MODE=1` в окружении (не для production).

Exit code **1** — есть предупреждения, деплой лучше отложить.

Дополнительно: `node scripts/audit-users-duplicates.js` — детальный список дубликатов.

## Авторизация (после обновления)

- Вход: **ник или email** (оба работают на сервере; в UI: «Ник или email»).
- Старые аккаунты с `name IS NULL` — вход **только по email**, не по нику.
- Повторная регистрация с тем же ником возможна, если у старой записи не был задан `name`.
- На prod проверить: `pre-deploy-check.js` → блок «Дубликаты ников» / «Подозрение re-reg».

## Стадион

- Расписание хранится в **`stadium_matches`** (`starts_at`, `status`).
- При **рестарте** `sanitizeScheduledMatches()` **не меняет** матчи, если `STADIUM_TEST_MODE` не задан.
- **Dev-only:** локально можно включить `STADIUM_TEST_MODE=1` — тогда scheduled-матчи выравниваются на «завтра 23:00» при старте.
- **Production:** переменную **не задавать**. Расписание: 12:00, 16:00, 20:00, 22:00.
- `seedStadiumDemoIfEmpty()` создаёт демо-матчи только если таблица **полностью пуста**.

Проверка после `pm2 restart`:

```bash
DB_PATH=/var/lib/fanaty/users.db node scripts/pre-deploy-check.js
# сравните starts_at / «~Xч» до и после рестарта — должны совпадать
```

## Паб (`pub_chat`)

- Сообщения в БД, таблица **`pub_chat`**.
- При **рестарте** сообщения **не удаляются**.
- Лимит **100 последних** — обрезка только при **отправке** нового сообщения (`trimPubChatMessages`).
- Если пропали **все** старые сообщения сразу — скорее **пустая/другая `users.db`**, а не рестарт.

## Правильный деплой

### 1. Вынести базу из папки деплоя (рекомендуется)

На сервере один раз:

```bash
sudo mkdir -p /var/lib/fanaty
sudo cp /path/to/old/project/users.db /var/lib/fanaty/users.db
sudo chown YOUR_USER:YOUR_USER /var/lib/fanaty/users.db
```

В pm2 / systemd / `.env`:

```bash
DB_PATH=/var/lib/fanaty/users.db
```

Тогда `scp` кода в `/home/user/fanaty/` **не трогает** базу.

### 2. Бэкап перед каждым обновлением

```bash
DB_PATH=/var/lib/fanaty/users.db node scripts/backup-users-db.js
```

Копия появится в `/var/lib/fanaty/backups/users-YYYY-MM-DDTHH-MM-SS.db`.

### 3. Обновлять только код, не всю папку

```bash
# Плохо — если внутри лежит users.db:
# rm -rf fanaty && scp -r fanaty server:/app/

# Лучше — только исходники, без .db:
rsync -av --exclude users.db --exclude node_modules ./ server:/app/fanaty/
cd /app/fanaty && npm install && pm2 restart fanaty
```

### 4. Проверка после рестарта

В логах сервера должно быть:

```
[db] /var/lib/fanaty/users.db — зарегистрировано игроков: 42
```

Если **0 игроков** на боевом сервере — **сразу остановить деплой** и восстановить бэкап:

```bash
cp /var/lib/fanaty/backups/users-....db /var/lib/fanaty/users.db
pm2 restart fanaty
```

## Восстановление из бэкапа

```bash
pm2 stop fanaty
cp /var/lib/fanaty/backups/users-НУЖНАЯ-ДАТА.db /var/lib/fanaty/users.db
pm2 start fanaty
```

## Чеклист перед обновлением

- [ ] `DB_PATH=... node scripts/backup-users-db.js`
- [ ] `DB_PATH=... node scripts/pre-deploy-check.js` — нет критических предупреждений
- [ ] `DB_PATH` указывает на файл **вне** папки деплоя
- [ ] `scp`/`rsync` **не** копирует `users.db` с локальной машины
- [ ] Зафиксированы: игроки (всего / с ником), герой дня, pub_chat, ближайший матч стадиона
- [ ] После `pm2 restart`: снова `pre-deploy-check.js` — цифры не упали
- [ ] В логах: `[db] зарегистрировано игроков: N` (N > 0 на prod)
