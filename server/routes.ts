import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBookSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";

// Configure multer for file uploads
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage_multer = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'book-cover-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage_multer,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only JPEG, JPG, and PNG files are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded files
  app.use('/uploads', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  });
  app.use('/uploads', express.static(uploadsDir));
  // Get all books
  app.get("/api/books", async (req, res) => {
    try {
      const books = await storage.getAllBooks();
      res.json(books);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch books" });
    }
  });

  // Get featured books
  app.get("/api/books/featured", async (req, res) => {
    try {
      const books = await storage.getFeaturedBooks();
      res.json(books);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch featured books" });
    }
  });

  // Get single book
  app.get("/api/books/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid book ID" });
      }

      const book = await storage.getBook(id);
      if (!book) {
        return res.status(404).json({ message: "Book not found" });
      }

      res.json(book);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch book" });
    }
  });

  // Search books
  app.get("/api/books/search/:query", async (req, res) => {
    try {
      const query = req.params.query;
      const books = await storage.searchBooks(query);
      res.json(books);
    } catch (error) {
      res.status(500).json({ message: "Failed to search books" });
    }
  });

  // Get books by genre
  app.get("/api/books/genre/:genre", async (req, res) => {
    try {
      const genre = req.params.genre;
      const books = await storage.getBooksByGenre(genre);
      res.json(books);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch books by genre" });
    }
  });

  // Upload book cover
  app.post("/api/books/upload-cover", upload.single('cover'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const coverUrl = `/uploads/${req.file.filename}`;
      res.json({ coverUrl });
    } catch (error) {
      res.status(500).json({ message: "Failed to upload cover image" });
    }
  });

  // Create book
  app.post("/api/books", async (req, res) => {
    try {
      const bookData = insertBookSchema.parse(req.body);
      const book = await storage.createBook(bookData);
      res.status(201).json(book);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid book data", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create book" });
    }
  });

  // Update book
  app.patch("/api/books/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid book ID" });
      }

      const updateData = insertBookSchema.partial().parse(req.body);
      const book = await storage.updateBook(id, updateData);
      
      if (!book) {
        return res.status(404).json({ message: "Book not found" });
      }

      res.json(book);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid book data", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to update book" });
    }
  });

  // Delete book
  app.delete("/api/books/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid book ID" });
      }

      const deleted = await storage.deleteBook(id);
      if (!deleted) {
        return res.status(404).json({ message: "Book not found" });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete book" });
    }
  });

  // Get admin statistics
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const allBooks = await storage.getAllBooks();
      const featuredBooks = await storage.getFeaturedBooks();
      const today = new Date().toISOString().split('T')[0];
      const recentBooks = allBooks.filter(book => book.dateAdded === today);

      const genres = new Set(allBooks.map(book => book.genre));
      const stats = {
        totalBooks: allBooks.length,
        totalCategories: Array.from(genres).length,
        featuredBooks: featuredBooks.length,
        recentBooks: recentBooks.length
      };

      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
