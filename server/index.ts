import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import MemoryStore from "memorystore";
import cookieParser from "cookie-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Middleware для парсинга JSON и cookies
app.use(express.json());
app.use(cookieParser());

// Session configuration
const MemoryStoreSession = MemoryStore(session);
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: true,
  saveUninitialized: true,
  store: new MemoryStoreSession({
    checkPeriod: 86400000 // prune expired entries every 24h
  }),
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax',
    path: '/'
  }
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(
  async (username, password, done) => {
    try {
      console.log('Login attempt:', { username, password });
      if (username === 'admin' && password === 'admin123') {
        const user = { id: 1, username: 'admin' };
        console.log('Login successful, user:', user);
        return done(null, user);
      }
      console.log('Login failed: Invalid credentials');
      return done(null, false, { message: 'Invalid credentials' });
    } catch (error) {
      console.error('Login error:', error);
      return done(error);
    }
  }
));

passport.serializeUser((user: any, done) => {
  console.log('Serializing user:', user);
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    console.log('Deserializing user:', id);
    if (id === 1) {
      const user = { id: 1, username: 'admin' };
      console.log('Deserialized user:', user);
      return done(null, user);
    }
    console.log('Deserialization failed: User not found');
    return done(null, false);
  } catch (error) {
    console.error('Deserialize error:', error);
    return done(error);
  }
});

// API endpoints
app.post('/api/admin/login', (req, res, next) => {
  console.log('Login request body:', req.body);
  passport.authenticate('local', (err: any, user: any, info: any) => {
    console.log('Auth callback:', { err, user, info });
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.status(401).json({ message: info.message || 'Invalid credentials' });
    }
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      console.log('Login successful, session:', req.session);
      console.log('User after login:', req.user);
      return res.json({ message: 'Login successful' });
    });
  })(req, res, next);
});

app.post('/api/admin/logout', (req, res) => {
  console.log('Logout request, session before:', req.session);
  req.logout(() => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
        return res.status(500).json({ message: 'Error during logout' });
      }
      res.clearCookie('connect.sid');
      console.log('Logout successful, session destroyed');
      res.json({ message: 'Logout successful' });
    });
  });
});

// Middleware для проверки аутентификации
const isAuthenticated = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.log('Auth check:', { 
    isAuthenticated: req.isAuthenticated(), 
    session: req.session,
    user: req.user,
    path: req.path,
    method: req.method,
    body: req.body,
    cookies: req.cookies
  });
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized' });
};

// Middleware для обработки ошибок
const errorHandler = (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', {
    error: err,
    path: req.path,
    method: req.method,
    body: req.body,
    session: req.session
  });
  res.status(500).json({ message: 'Internal server error' });
};

// Регистрируем маршруты
registerRoutes(app);

// Защищаем все API маршруты
app.use('/api', isAuthenticated);

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'))
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});

const upload = multer({ storage: storage });

// Статические файлы
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/assets', express.static(path.join(__dirname, '../client/dist/assets')));
app.use(express.static(path.join(__dirname, '../client/dist')));

// Защищенные админские эндпоинты
app.get('/api/admin/stats', isAuthenticated, async (req, res) => {
  try {
    // Временно возвращаем тестовые данные
    res.json({
      totalBooks: 0,
      totalCategories: 0,
      featuredBooks: 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Обработка всех остальных маршрутов
app.get('*', (req, res) => {
  // Если запрос к админ-панели и пользователь не аутентифицирован, перенаправляем на страницу входа
  if (req.path.startsWith('/admin') && !req.isAuthenticated()) {
    if (req.path === '/admin/login') {
      return res.sendFile(path.join(__dirname, '../client/dist/index.html'));
    }
    return res.redirect('/admin/login');
  }
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Добавляем обработчик ошибок в конце
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
