const express = require("express");
const path = require("path");
const mysql = require("mysql2");
const session = require("express-session");
const app = express();
const multer = require("multer");

const urlencodedParser = express.urlencoded({
  extended: false,
});

app.set("view engine", "ejs"); // подключение шаблонизатора

const PORT = 4455;

const connection = mysql.createConnection({ // подключение к БД
  
  host: "127.0.0.1",
  user: "root",
  database: "offliner",
  password: "root",
});
connection.connect((err) => {
  if (err) {
    return console.error("ERROR: " + err.message);
  } else {
    console.log("Connected to SQL");
  }
});

connection.execute("SELECT * FROM users", (err, results) => { // запрос для вывода содержимого БД в консоль
  

  console.log(results);
});

const createPath = (page) =>
  path.resolve(__dirname, "ejs-pages", `${page}.ejs`); // создание абсолютного пути (ссылка)

app.listen(PORT, (error) => { // прослушка порта
  
  if (error) {
    console.log(error);
  } else {
    console.log(`listening port ${PORT}`);
  }
});
app.use(
  session({
    secret: "cool",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(
  express.urlencoded({ // ПО для бодипарсера
    
    extended: false,
  })
);

app.get("/login", function (req, res) {
  // получение списка пользователей
  connection.query("SELECT * FROM users", function (err, data) {
    if (err) return console.log(err);
    res.render(createPath("log"), {
      users: data,
    });
  });
});

app.get("/registration", function (req, res) { //  возврат формы для добавления данных
 
  res.render(createPath("reg"));
});

app.post("/registration", urlencodedParser, function (req, res) {
  if (!req.body) return res.sendStatus(400);

  const email = req.body.email;
  const password = req.body.password;

  if (email === "" || password === "") {// проверка на заполненность
    
    res.send("He все поля заполнены");
  } else {
    connection.query(
      "SELECT * FROM users WHERE email = ?",
      [email],
      function (err, data) {
        if (err) return console.log(err);

        if (data.length > 0) { // проверка на наличие аккаунта в базе данных
         
          res.send("Этот email уже зарегистрирован");
        } else {
          connection.query(
            "INSERT INTO users (email, password) VALUES (?,?)",
            [email, password],
            function (err, data) {
              if (err) return console.log(err);
              res.redirect("/login");
            }
          );
        }
      }
    );
  }
});

app.get("/", (req, res) => {
  const user_id = req.session.user_id;

  if (user_id) {
    connection.query(
      "SELECT * FROM users WHERE id = ?", // Запрос данных из таблицы cart
      [user_id],
      (err, rows) => {
        if (err) throw err;

        
        const query =
          "SELECT smartphone_id FROM cart WHERE user_id=" + user_id + ";";
        connection.query(query, function (err, result) {
          if (err) throw err;
          const smartphone_ids = result.map((item) => item.smartphone_id);
          const smartphones_query =
            "SELECT * FROM smartphones WHERE id IN (" +
            smartphone_ids.join(",") +
            ");";
          connection.query(smartphones_query, function (err, result) {
            const smartphones = result;
            res.render(createPath("home"), { // вывод информации о пользователе и списка товаров на страницу home
              
              user_id: rows[0].id,
              user_email: rows[0].email,
              smartphones: smartphones,
              cart: smartphone_ids,
            });
          });
        });
      }
    );
  } else {
    res.redirect("/cartErr");
  }
});

app.get("/cartErr", (req, res) => {
  res.render(createPath("cartErr"));
});

app.post("/login", (req, res) => { // обработка запроса на авторизацию
 
  const email = req.body.emailLog;
  const password = req.body.passwordLog;

  connection.query(
    "SELECT * FROM users WHERE email = ? AND password = ?",
    [email, password],
    (err, rows) => {
      if (err) throw err;

      if (rows.length > 0) {
        if (email === "admin" && password === "admin") { // проверка, что пользователь - админ
         
          req.session.user_id = rows[0].id;
          req.session.user_email = rows[0].email;
          res.redirect("/admin");
        } else {
          req.session.user_id = rows[0].id; // сохранение id пользователя в сессии
          req.session.user_email = rows[0].email;
          res.redirect("/");
        }
      } else {
        res.send("Неверный логин или пароль");
      }
    }
  );
});

app.get("/category", function (req, res) {
  res.render(createPath("category"));
});

app.get("/smartphones", function (req, res) {
  connection.query("SELECT * FROM smartPhones", function (err, data) {
    if (err) return console.log(err);
    res.render(createPath("smartPhones"), {
      smartPhones: data,
    });
  });
});

app.get("/smartPhone/:id", (req, res) => { // страница отдельного смартфона, запрос по id
  
  const smartPhoneId = req.params.id;
  connection.query(
    "SELECT * FROM smartPhones WHERE id=?",
    smartPhoneId,
    (err, data) => {
      if (err) return console.log(err);
      connection.query(
        "SELECT * FROM comments  WHERE smartPhoneId=? ORDER BY id DESC",
        smartPhoneId,
        (err, commentsData) => {
          if (err) return console.log(err);
          res.render(createPath("product"), {
            smartPhones: data,
            comments: commentsData,
            session: req.session,
          });
        }
      );
    }
  );
});

app.post("/smartPhone/:id/addComment", (req, res) => { // обработка отправки формы добавления комментария
  
  const userId = req.session.user_id;
  const smartPhoneId = req.params.id;
  const userEmail = req.session.user_email;
  const commentText = req.body.commentText;
  if (!userId) {
    // если пользователь не зарегистрирован
    res.redirect("/login");
  } else {
    connection.query(
      "INSERT INTO comments (smartPhoneId, userEmail, commentText) VALUES (?, ?, ?)",
      [smartPhoneId, userEmail, commentText],
      (err, result) => {
        if (err) return console.log(err);
        res.redirect(`/smartPhone/${smartPhoneId}`);
      }
    );
  }
});

app.post("/smartPhone/:id/deleteComment/:commentId", (req, res) => { // Обработка запроса на удаление комментария
 

  const smartPhoneId = req.params.id;
  const commentId = req.params.commentId;
  const userEmail = req.session.user_email;

  if (userEmail === "admin") { // проверка, что пользователь - админ
    
    connection.query(
      "DELETE FROM comments WHERE id=?",
      [commentId],
      (err, result) => { // сдаление комментария с заданным идентификатором
       
        if (err) return console.log(err);
        res.redirect(`/smartPhone/${smartPhoneId}`);
      }
    );
  } else {
    connection.query(
      "SELECT * FROM comments WHERE id=? AND userEmail=?",
      [commentId, userEmail],
      (err, result) => { // проверка наличия комментария с заданным идентификатором и принадлежности его пользователю
        
        if (err) return console.log(err);

        if (result.length === 0) { // если комментарий не найден или не принадлежит пользователю- err
          
          res.status(403).send("access error");
        } else {
          connection.query(
            "DELETE FROM comments WHERE id=?",
            [commentId],
            (err, result) => { // удаление комментария с заданным идентификатором
             
              if (err) return console.log(err);
              res.redirect(`/smartPhone/${smartPhoneId}`);
            }
          );
        }
      }
    );
  }
});

app.get("/logout", (req, res) => {
  // logout
  req.session.user_id = null;
  req.session.user_email = null;
  res.redirect("/category");
});

app.get("/priceASC", (req, res) => { // сортировка с минимальной цены, запрос к БД, где обращаюсь к столбцу price и сортирую благодаря параметру ASC
  

  const title = "Sort";

  connection.query(
    "SELECT * FROM smartphones ORDER BY price ASC",
    (err, data) => {
      if (err) return console.log(err);
      res.render(createPath("sort"), {
        smartPhones: data,
      });
    }
  );
});

app.get("/priceDESC", (req, res) => { // сортировка с максимальной цены, запрос к БД, где обращаюсь к столбцу price и сортирую благодаря параметру DESC
  

  const title = "Sort";

  connection.query(
    "SELECT * FROM smartphones ORDER BY price DESC",
    (err, data) => {
      if (err) return console.log(err);
      res.render(createPath("sort"), {
        smartPhones: data,
      });
    }
  );
});

app.get("/dateDESC", (req, res) => { // сортировка с минимальной цены, запрос к БД, где обращаюсь к столбцу price и сортирую благодаря параметру ASC
  

  const title = "Sort";

  connection.query(
    "SELECT * FROM smartphones ORDER BY date DESC",
    (err, data) => {
      if (err) return console.log(err);
      res.render(createPath("sort"), {
        smartPhones: data,
      });
    }
  );
});

app.post("/filter", (req, res) => {
  const selectedName = req.body.smartphone; // массив выбранных имен смартфонов из формы
  const selectedDate = req.body.date;
  const selectedSystem = req.body.system;
  let filterName = ""; // запрос с динамически формируемым условием

  if (!selectedName && !selectedDate && !selectedSystem) { // если ничего не выбрано, перезагружаем страницу
   
    return res.redirect("/smartphones");
  }
  if ( // вариации фильтраций
    selectedName &&
    selectedName.length > 0 &&
    (!selectedDate || selectedDate.length === 0) &&
    (!selectedSystem || selectedSystem.length === 0)
  ) {
    filterName +=
      "SELECT * FROM smartphones WHERE name IN (" +
      mysql.escape(selectedName) +
      ")";
  } else if (
    selectedDate &&
    selectedDate.length > 0 &&
    (!selectedName || selectedName.length === 0) &&
    (!selectedSystem || selectedSystem.length === 0)
  ) {
    filterName +=
      "SELECT * FROM smartphones WHERE date IN (" +
      mysql.escape(selectedDate) +
      ")";
  } else if (
    selectedSystem &&
    selectedSystem.length > 0 &&
    (!selectedName || selectedName.length === 0) &&
    (!selectedDate || selectedDate.length === 0)
  ) {
    filterName +=
      "SELECT * FROM smartphones WHERE system IN (" +
      mysql.escape(selectedSystem) +
      ")";
  } else if (
    selectedName &&
    selectedName.length > 0 &&
    selectedDate &&
    selectedDate.length > 0 &&
    (!selectedSystem || selectedSystem.length === 0)
  ) {
    filterName +=
      "SELECT * FROM smartphones WHERE name IN (" +
      mysql.escape(selectedName) +
      ") AND date IN (" +
      mysql.escape(selectedDate) +
      ")";
  } else if (
    selectedSystem &&
    selectedSystem.length > 0 &&
    selectedName &&
    selectedName.length > 0 &&
    (!selectedDate || selectedDate.length === 0)
  ) {
    filterName +=
      "SELECT * FROM smartphones WHERE system IN (" +
      mysql.escape(selectedSystem) +
      ") AND name IN (" +
      mysql.escape(selectedName) +
      ")";
  } else if (
    selectedSystem &&
    selectedSystem.length > 0 &&
    selectedDate &&
    selectedDate.length > 0 &&
    (!selectedName || selectedName.length === 0)
  ) {
    filterName +=
      "SELECT * FROM smartphones WHERE system IN (" +
      mysql.escape(selectedSystem) +
      ") AND date IN (" +
      mysql.escape(selectedDate) +
      ")";
  } else if (
    selectedSystem &&
    selectedSystem.length > 0 &&
    selectedName &&
    selectedName.length > 0 &&
    selectedDate &&
    selectedDate.length > 0
  ) {
    filterName +=
      "SELECT * FROM smartphones WHERE system IN (" +
      mysql.escape(selectedSystem) +
      ") AND name IN (" +
      mysql.escape(selectedName) +
      ") AND date IN (" +
      mysql.escape(selectedDate) +
      ")";
  }

  
  connection.query(filterName, (error, results) => { // выполнение запроса к базе данных и отправка результата пользователю
    if (error) throw error;
    res.render(createPath("filter"), {
      smartPhones: results,
    });
  });
});

app.get("/filter/:name", function (req, res) {
  const smartPhoneName = req.params.name;
  connection.query(
    "SELECT * FROM smartPhones WHERE name=?",
    smartPhoneName,
    (err, data) => {
      if (err) return console.log(err);
      res.render(createPath("filter"), {
        smartPhones: data,
      });
    }
  );
});

app.use(express.static(__dirname)); // путь к папке с изображениями
app.use(
  multer({ // путь загрузки изображения
    
    dest: "images",
  }).single("photo")
);

app.post("/admin", urlencodedParser, (req, res) => { // создание поста, получаю данные из форм, обращаюсь к бд, где вставляю в таблицу введенные ранее значения
  

  if (!req.body) return res.sendStatus(400);
  const name = req.body.name;
  const model = req.body.model;
  const price = req.body.price;
  const img = req.file.filename;
  const date = req.body.date;
  const system = req.body.system;
  const description = req.body.description;
  const specs = req.body.specs;
  connection.query(
    "INSERT INTO smartPhones (name,model,description,date,system,specs,price,img) VALUES (?,?,?,?,?,?,?,?)",
    [name, model, description, date, system, specs, price, img],
    (err, data) => {
      if (err) return console.log(err);
      res.redirect("/admin");
    }
  );
});

app.get("/admin", (req, res) => { // запрос к БД для вывода данных на страницу /admin
  

  const title = "admin";
  if (req.session.user_email != "admin") {
    res.render(createPath("notFind"));
  } else {
    connection.query(
      "SELECT * FROM smartPhones ORDER BY id DESC",
      (err, smartphonesData) => {
        if (err) return console.log(err);
        connection.query("SELECT * FROM users", (err, usersData) => {
          if (err) return console.log(err);
          res.render(createPath("admin"), {
            smartPhones: smartphonesData,
            users: usersData,
          });
        });
      }
    );
  }
});

app.post("/smartPhones/:id", (req, res) => { // удаление поста. получаю id, обращаюсь к БД, где удаляю пост с заданным id
  

  const id = req.params.id;
  connection.query("DELETE FROM smartPhones WHERE id=?", [id], (err, data) => {
    if (err) return console.log(err);
    res.redirect("/admin");
  });
});

app.post("/users/:id", (req, res) => { // удаление поста. получаю id, обращаюсь к БД, где удаляю пост с заданным id
  

  const id = req.params.id;
  connection.query("DELETE FROM users WHERE id=?", [id], (err, data) => {
    if (err) return console.log(err);
    res.redirect("/admin");
  });
});

app.post("/add-to-cart/:id", function (req, res) {
  const smartphoneId = req.params.id;
  const userId = req.session.user_id;

  if (!userId) { // если пользователь не зарегистрирован
    
    res.redirect("/login");
  } else {
    connection.query(
      "INSERT INTO cart (user_id, smartphone_id) VALUES (?, ?)",
      [userId, smartphoneId],
      function (err, result) {
        if (err) throw err;

        res.redirect("/");
      }
    );
  }
});

app.post("/cart/delete", (req, res) => {
  const userId = req.session.user_id;
  const smartphone_id = req.body.smartphone_id;

  if (userId && smartphone_id) {
    connection.query(
      "DELETE FROM cart WHERE user_id = ? AND smartphone_id = ?",
      [userId, smartphone_id],
      (err, result) => {
        if (err) throw err;
        res.redirect("/");
      }
    );
  } else {
    res.redirect("/category");
  }
});

app.use((req, res) => { // ERROR 404
  
  const title = "ERROR 404";
  res.render(createPath("notFind"), {
    title,
  });
});
