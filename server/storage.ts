import {
  users,
  customers,
  consultations,
  type User,
  type UpsertUser,
  type Customer,
  type InsertCustomer,
  type Consultation,
  type InsertConsultation,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  // These user operations are required for authentication.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Customer operations
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  getCustomer(id: number, userId: string): Promise<Customer | undefined>;
  getUserCustomers(userId: string): Promise<Customer[]>;
  updateCustomer(id: number, updates: Partial<InsertCustomer>): Promise<Customer>;
  deleteCustomer(id: number, userId: string): Promise<void>;
  
  // Consultation operations
  createConsultation(consultation: InsertConsultation): Promise<Consultation>;
  getConsultation(id: number, userId: string): Promise<Consultation | undefined>;
  getUserConsultations(userId: string): Promise<Consultation[]>;
  getCustomerConsultations(customerId: number, userId: string): Promise<Consultation[]>;
  updateConsultation(id: number, updates: Partial<InsertConsultation>): Promise<Consultation>;
  deleteConsultation(id: number, userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  // These user operations are required for authentication.

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Consultation operations
  async createConsultation(consultation: InsertConsultation): Promise<Consultation> {
    const [newConsultation] = await db
      .insert(consultations)
      .values(consultation)
      .returning();
    return newConsultation;
  }

  async getConsultation(id: number, userId: string): Promise<Consultation | undefined> {
    const [result] = await db
      .select()
      .from(consultations)
      .where(and(eq(consultations.id, id), eq(consultations.userId, userId)));
    
    if (!result) return undefined;
    return result;
  }

  async getUserConsultations(userId: string): Promise<Consultation[]> {
    return await db
      .select()
      .from(consultations)
      .where(eq(consultations.userId, userId))
      .orderBy(desc(consultations.recordedAt));
  }

  async updateConsultation(id: number, updates: Partial<InsertConsultation>): Promise<Consultation> {
    const [updatedConsultation] = await db
      .update(consultations)
      .set(updates)
      .where(eq(consultations.id, id))
      .returning();
    return updatedConsultation;
  }

  async deleteConsultation(id: number, userId: string): Promise<void> {
    await db
      .delete(consultations)
      .where(and(eq(consultations.id, id), eq(consultations.userId, userId)));
  }

  // Customer operations
  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const [newCustomer] = await db
      .insert(customers)
      .values(customer)
      .returning();
    return newCustomer;
  }

  async getCustomer(id: number, userId: string): Promise<Customer | undefined> {
    const [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, id), eq(customers.userId, userId)));
    return customer;
  }

  async getUserCustomers(userId: string): Promise<Customer[]> {
    return await db
      .select()
      .from(customers)
      .where(eq(customers.userId, userId))
      .orderBy(desc(customers.createdAt));
  }

  async updateCustomer(id: number, updates: Partial<InsertCustomer>): Promise<Customer> {
    const [updatedCustomer] = await db
      .update(customers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return updatedCustomer;
  }

  async deleteCustomer(id: number, userId: string): Promise<void> {
    await db.delete(customers)
      .where(and(eq(customers.id, id), eq(customers.userId, userId)));
  }

  async getCustomerConsultations(customerId: number, userId: string): Promise<Consultation[]> {
    return await db
      .select()
      .from(consultations)
      .where(and(eq(consultations.customerId, customerId), eq(consultations.userId, userId)))
      .orderBy(desc(consultations.recordedAt));
  }
}

export const storage = new DatabaseStorage();
