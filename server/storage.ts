import { type Book, type InsertBook, type User, type InsertUser } from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Book methods
  getAllBooks(): Promise<Book[]>;
  getBook(id: number): Promise<Book | undefined>;
  createBook(book: InsertBook): Promise<Book>;
  updateBook(id: number, book: Partial<InsertBook>): Promise<Book | undefined>;
  deleteBook(id: number): Promise<boolean>;
  getFeaturedBooks(): Promise<Book[]>;
  getBooksByGenre(genre: string): Promise<Book[]>;
  searchBooks(query: string): Promise<Book[]>;
}

export class LocalStorage implements IStorage {
  private books: Book[] = [];
  private users: User[] = [];
  private nextBookId = 1;
  private nextUserId = 1;

  async getUser(id: number): Promise<User | undefined> {
    return this.users.find(user => user.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.users.find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user: User = {
      id: this.nextUserId++,
      ...insertUser
    };
    this.users.push(user);
    return user;
  }

  async getAllBooks(): Promise<Book[]> {
    return [...this.books];
  }

  async getBook(id: number): Promise<Book | undefined> {
    return this.books.find(book => book.id === id);
  }

  async createBook(insertBook: InsertBook): Promise<Book> {
    const book: Book = {
      id: this.nextBookId++,
      ...insertBook,
      description: insertBook.description || null,
      amazonLink: insertBook.amazonLink || null,
      coverColor: insertBook.coverColor || "purple",
      coverImage: insertBook.coverImage ?? null,
      featured: insertBook.featured || false,
      dateAdded: insertBook.dateAdded || new Date().toISOString().split('T')[0]
    };
    this.books.push(book);
    return book;
  }

  async updateBook(id: number, updateData: Partial<InsertBook>): Promise<Book | undefined> {
    const index = this.books.findIndex(book => book.id === id);
    if (index === -1) return undefined;

    this.books[index] = {
      ...this.books[index],
      ...updateData
    };
    return this.books[index];
  }

  async deleteBook(id: number): Promise<boolean> {
    const initialLength = this.books.length;
    this.books = this.books.filter(book => book.id !== id);
    return this.books.length !== initialLength;
  }

  async getFeaturedBooks(): Promise<Book[]> {
    return this.books.filter(book => book.featured);
  }

  async getBooksByGenre(genre: string): Promise<Book[]> {
    return this.books.filter(book => book.genre === genre);
  }

  async searchBooks(query: string): Promise<Book[]> {
    const lowercaseQuery = query.toLowerCase();
    return this.books.filter(book => 
      book.title.toLowerCase().includes(lowercaseQuery) ||
      book.author.toLowerCase().includes(lowercaseQuery) ||
      book.genre.toLowerCase().includes(lowercaseQuery)
    );
  }
}

export const storage = new LocalStorage();
