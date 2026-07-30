import { pgTable, serial, text, integer, numeric, jsonb, timestamp } from "drizzle-orm/pg-core"

// Produtos do estoque, importados da planilha oficial do Mercado Livre.
// A coluna `raw` guarda a linha original completa da planilha (array de 36 colunas)
// para permitir reexportar no formato idêntico ao do ML.
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull(),
  barcode: text("barcode"),
  mlItemId: text("ml_item_id"),
  title: text("title"),
  price: numeric("price"),
  quantity: integer("quantity").notNull().default(0),
  rowIndex: integer("row_index"),
  raw: jsonb("raw"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

// Configurações da aplicação. Usada para guardar o template (base64) da planilha
// oficial do ML, para que a exportação preserve abas, cabeçalhos e formatação.
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type Product = typeof products.$inferSelect
