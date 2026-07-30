// Estrutura da planilha oficial do Mercado Livre (aba "Anúncios").
// A aba tem 5 linhas de cabeçalho; os dados começam na linha de índice 5.
export const ML_SHEET_NAME = "Anúncios"
export const ML_HEADER_ROWS = 5 // linhas 0..4 são cabeçalho

// Índices das colunas relevantes (0-based).
export const COL = {
  FAMILY_ID: 0,
  ITEM_ID: 1,
  PRODUCT_NUMBER: 2,
  VARIATION_ID: 3,
  SKU: 4,
  TITLE: 5,
  VARIATIONS: 6,
  QUANTITY: 7, // "Estoque no depósito"
  PRICE: 8,
} as const

export function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0
  if (typeof value === "number") return value
  const n = Number(String(value).replace(/\./g, "").replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

export function cellString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s === "" ? null : s
}
