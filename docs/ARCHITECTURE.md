# Архитектура «Фанаты» — модульный монолит

Проект развивается как **модульный монолит**: один сервер, одна БД (SQLite), но с **чёткими границами доменов**. Полного переписывания и big bang рефакторинга нет — улучшения идут **параллельно с игровыми фичами**.

## Принципы

1. **Игра важнее рефакторинга** — новые механики не ждут «идеальной» структуры, но **новые крупные системы** сразу кладём в свою папку/модуль.
2. **`server.js` постепенно худеет** — только bootstrap, общие middleware и подключение роутеров/сервисов.
3. **Один источник правды** для пересекающихся вещей (статы, валюты, репутация) — папка `core/`.
4. **Каталоги живут в домене** — предметы барыги в `inventory/`, талисманы в `talismans/`, провиант в `provisions/`.
5. **Сквозные эффекты — явно** — победа в районе не размазывает 15 UPDATE по файлам; по возможности один сервис исхода боя + учёт репы/серебра.

## Целевая карта модулей

| Папка / модуль | Ответственность | Статус |
|----------------|-----------------|--------|
| `core/` | parse-json, статы игрока, валюты, репутация (постепенно) | **в работе** |
| `combat/` + `fight-ssr.js` | Формулы боя, SSR страницы боя | частично (`fight-ssr` в корне) |
| `district/` | Спавн, боты, kick, исходы районных боёв | в `server.js` |
| `inventory/` | Барыга, гардероб, `SHOP_ITEMS`, equip, gear-upgrades | каталог в `server.js`, UI в `public/` |
| `talismans/` | Каталог, покупка, эффекты | `talismans.js`, `talisman-effects.js` |
| `provisions/` | Расходники, использование в махаче | `provisions-data.js` |
| `stadium/` | Матчи, трибуны, касса, газета | `stadium-*.js` (корень) |
| `pub-battle/` | Битва за Паб: расписание, комнаты, координация, бой на базе stadium-engine | **в работе** (`pub-battle/`) |
| `rating/` | Элита клуба, rep_earnings | `rep-earnings.js`, `club-elite.js` |
| `national-teams/` | Сборные: каталог, выбор при регистрации, рейтинг | **в работе** (`national-teams/`) |
| `economy/` | Оплата ($ / грибы / серебро) | `purchase-logic.js` |

## Правила для новых фич

- **Не добавлять** большие блоки логики в конец `server.js` без плана выноса.
- Новая механика (пустырь, …) → минимум `feature-name/service.js` + `feature-name/routes.js` (или один `index.js` с `registerRoutes(app, deps)`).
- **Битва за Паб** — эталон: `pub-battle/index.js`, `service.js`, `engine.js`, `routes.js`, `scheduler.js`, `combat-bridge.js`, `db.js`.
- Общие константы (MAX_HP, MAX_RAGE) → по мере выноса в `core/constants.js`.
- Перед изменением боя/статов — смотреть `core/player-stats.js`.
- Перед изменением цен/оплаты — `purchase-logic.js` и будущий `core/currency.js`.

## Порядок выноса (без остановки разработки)

1. ✅ `core/parse-json.js`, `core/player-stats.js` — эффективные статы (тату + шмот + прокачка).
2. `core/currency.js` — серебро, доллары, грибы, единые spend/grant.
3. `core/reputation.js` — репутация, черепки, обёртка над `rep-earnings`.
4. `inventory/` — `SHOP_ITEMS`, `/shop/*`, `/larek/*`, связь с `gear-upgrades`.
5. `combat/district-outcomes.js` — `finishDistrictFightWin/Lost`.
6. `district/routes.js` — спавн, refresh, fight-gear.
7. `rating/routes.js` — API рейтинга, убрать моки по мере готовности.
8. Перенос `stadium-*` в `stadium/` (только перемещение файлов + пути require).

## Зависимости

- Доменные модули **не должны** `require('./server')`.
- Допустимо: `core` ← `gear-upgrades`, `talismans` (утилиты).
- `fight-ssr` может вызывать `talisman-effects`; каталог талисманов в бой не тянем — только резолв эффектов для боя.

## Тесты (по мере сил)

Приоритет: `purchase-logic`, `xp-levels`, `club-elite`, `silver-loss`, один сценарий урона в `fight-ssr`.
