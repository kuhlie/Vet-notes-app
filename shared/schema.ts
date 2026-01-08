import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table.
// This table is required for server-side session storage.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// This table is required for authentication and ownership.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  clinicName: varchar("clinic_name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Customer storage table for tracking pet owners
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  patientId: varchar("patient_id").notNull(),
  name: varchar("name").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  address: text("address"),
  petName: varchar("pet_name"),
  petBreed: varchar("pet_breed"),
  petAge: varchar("pet_age"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const consultations = pgTable("consultations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  customerId: integer("customer_id").references(() => customers.id), // Make nullable for migration
  customerName: varchar("customer_name").notNull(), // Keep for backwards compatibility
  patientId: varchar("patient_id"),
  petName: varchar("pet_name"),
  fileName: varchar("file_name").notNull(),
  audioUrl: text("audio_url"),
  fullTranscription: text("full_transcription"),
  aiSoapNote: text("ai_soap_note"),
  finalSoapNote: text("final_soap_note"),
  isFinalized: boolean("is_finalized").notNull().default(false),
  duration: integer("duration"), // in seconds
  recordedAt: timestamp("recorded_at").defaultNow(),
  status: varchar("status").notNull().default("processing"), // processing, completed, failed
});

export const customerRelations = relations(customers, ({ one, many }) => ({
  user: one(users, {
    fields: [customers.userId],
    references: [users.id],
  }),
  consultations: many(consultations),
}));

export const consultationRelations = relations(consultations, ({ one }) => ({
  user: one(users, {
    fields: [consultations.userId],
    references: [users.id],
  }),
  customer: one(customers, {
    fields: [consultations.customerId],
    references: [customers.id],
  }),
}));

export const userRelations = relations(users, ({ many }) => ({
  consultations: many(consultations),
  customers: many(customers),
}));

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConsultationSchema = createInsertSchema(consultations).omit({
  id: true,
  recordedAt: true,
}).extend({
  customerId: z.number().optional(), // Make optional for backwards compatibility
});

export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Consultation = typeof consultations.$inferSelect;
export type InsertConsultation = z.infer<typeof insertConsultationSchema>;
