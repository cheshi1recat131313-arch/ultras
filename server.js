const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const app = express();
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
// Создаём базу
const db = new sqlite3.Database('./users.db');

// Создаём таблицу
db.run(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT,
  level INTEGER DEFAULT 1,
  money INTEGER DEFAULT 1000
)
`);

// Главная страница (форма регистрации)
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <title>Футбольные фанаты</title>
      <link rel="stylesheet" href="/style.css">
    </head>
    <body>
      <div class="container">
        <h1>⚽ Футбольные фанаты</h1>

        <form method="POST" action="/register">
          <input name="username" placeholder="Логин" required />
          <input name="password" type="password" placeholder="Пароль" required />
          <button type="submit">Зарегистрироваться</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// Регистрация
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  const hash = await bcrypt.hash(password, 10);

  db.run(
    `INSERT INTO users (username, password) VALUES (?, ?)`,
    [username, hash],
    function (err) {
      if (err) {
        return res.send('Ошибка: пользователь уже есть');
      }

      res.send(`
        <h2>Ты зарегистрирован!</h2>
        <a href="/player/${this.lastID}">Перейти в профиль</a>
      `);
    }
  );
});

// Профиль игрока
app.get('/player/:id', (req, res) => {
  db.get(
    `SELECT * FROM users WHERE id = ?`,
    [req.params.id],
    (err, user) => {
      if (!user) return res.send('Игрок не найден');

      res.send(`
        <h1>👤 ${user.username}</h1>
        <p>Уровень: ${user.level}</p>
        <p>Деньги: ${user.money}</p>
        <a href="/fight/${user.id}">🔥 Пойти в район (драться)</a>
      `);
    }
  );
});

// Район (бой с ботом)
app.get('/fight/:id', (req, res) => {
  db.get(
    `SELECT * FROM users WHERE id = ?`,
    [req.params.id],
    (err, user) => {
      if (!user) return res.send('Игрок не найден');

      const result = Math.random() > 0.5 ? 'Победа! 🔥' : 'Поражение 💀';
      if (result === 'Победа! 🔥') {
        user.level += 1;
        user.money += 100;

        db.run(
          `UPDATE users SET level = ?, money = ? WHERE id = ?`,
          [user.level, user.money, user.id],
          () => {
            res.send(`
              <h1>Результат боя: ${result}</h1>
              <p>Ты стал уровнем выше!</p>
              <p>Теперь уровень: ${user.level}</p>
              <p>Деньги: ${user.money}</p>
              <a href="/player/${user.id}">Вернуться в профиль</a>
            `);
          }
        );
      } else {
        res.send(`
          <h1>Результат боя: ${result}</h1>
          <p>Увы, ты проиграл.</p>
          <a href="/player/${user.id}">Вернуться в профиль</a>
        `);
      }
    }
  );
});

// Старт сервера
app.listen(3000, () => {
  console.log('Сервер работает на http://localhost:3000');
});
