"use server"

import { db } from "@/lib/db"
import { products, appSettings } from "@/lib/db/schema"
import { asc, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { read, utils } from "xlsx"
import { XMLParser } from "fast-xml-parser"
import { ML_SHEET_NAME, ML_HEADER_ROWS, COL, toNumber, cellString } from "@/lib/ml-sheet"

const TEMPLATE_KEY = "ml_template_base64"

export type ActionResult = {
  ok: boolean
  message: string
  details?: string[]
}

// Lista todos os produtos em estoque.
export async function getProducts() {
  return db.select().from(products).orderBy(asc(products.title))
}

// Importa a planilha oficial do Mercado Livre (.xlsx).
// Popula/atualiza os produtos e guarda o arquivo como template para exportação.
export async function importMlSheet(formData: FormData): Promise<ActionResult> {
  const file = formData.get("file") as File | null
  if (!file || file.size === 0) {
    return { ok: false, message: "Nenhum arquivo enviado." }
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = read(buffer, { cellDates: false })

    const sheet = workbook.Sheets[ML_SHEET_NAME]
    if (!sheet) {
      return { ok: false, message: `A aba "${ML_SHEET_NAME}" não foi encontrada na planilha.` }
    }

    const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })
    const dataRows = rows.slice(ML_HEADER_ROWS)

    let imported = 0
    let skipped = 0

    for (const row of dataRows) {
      const sku = cellString(row[COL.SKU])
      if (!sku) {
        skipped++
        continue
      }
      const title = cellString(row[COL.TITLE])
      const price = toNumber(row[COL.PRICE])
      const quantity = Math.trunc(toNumber(row[COL.QUANTITY]))
      const mlItemId = cellString(row[COL.ITEM_ID])

      await db
        .insert(products)
        .values({
          sku,
          mlItemId,
          title,
          price: String(price),
          quantity,
          raw: row as unknown,
        })
        .onConflictDoUpdate({
          target: products.sku,
          set: {
            mlItemId,
            title,
            price: String(price),
            quantity,
            raw: row as unknown,
            updatedAt: new Date(),
          },
        })
      imported++
    }

    // Guarda o arquivo original como template para exportação idêntica.
    const base64 = buffer.toString("base64")
    await db
      .insert(appSettings)
      .values({ key: TEMPLATE_KEY, value: base64 })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: base64, updatedAt: new Date() } })

    revalidatePath("/")
    return {
      ok: true,
      message: `${imported} produto(s) importado(s).`,
      details: skipped > 0 ? [`${skipped} linha(s) sem SKU foram ignoradas.`] : undefined,
    }
  } catch (err) {
    console.log("[v0] importMlSheet error:", err instanceof Error ? err.message : err)
    return { ok: false, message: "Erro ao ler a planilha. Verifique se é o arquivo oficial do Mercado Livre." }
  }
}

// Normaliza o código de barras (GTIN). NF-e usa "SEM GTIN" quando não há.
function normalizeBarcode(value: unknown): string | null {
  const s = cellString(value)
  if (!s) return null
  if (/sem\s*gtin/i.test(s)) return null
  return s
}

// Importa um XML de NF-e e soma as quantidades ao estoque.
// Regra: casa primeiro pelo código do produto (cProd), depois pelo código de
// barras (cEAN/cEANTrib). Se o produto não existir, ele é criado automaticamente
// com todos os dados do XML. A importação nunca falha por produto não cadastrado.
export async function importNfeXml(formData: FormData): Promise<ActionResult> {
  const file = formData.get("file") as File | null
  if (!file || file.size === 0) {
    return { ok: false, message: "Nenhum arquivo XML enviado." }
  }

  try {
    const xml = await file.text()
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" })
    const parsed = parser.parse(xml)

    // Caminho padrão da NF-e: nfeProc > NFe > infNFe > det[]
    const infNFe = parsed?.nfeProc?.NFe?.infNFe ?? parsed?.NFe?.infNFe
    if (!infNFe) {
      return { ok: false, message: "Não foi possível encontrar os dados da NF-e no XML." }
    }

    let det = infNFe.det
    if (!det) return { ok: false, message: "A NF-e não contém itens (det)." }
    if (!Array.isArray(det)) det = [det]

    const updatedList: string[] = []
    const createdList: string[] = []

    for (const item of det) {
      const prod = item?.prod
      if (!prod) continue
      const cProd = cellString(prod.cProd)
      const qCom = Math.trunc(toNumber(prod.qCom))
      if (!cProd || qCom <= 0) continue

      const barcode = normalizeBarcode(prod.cEAN) ?? normalizeBarcode(prod.cEANTrib)
      const title = cellString(prod.xProd)
      const price = toNumber(prod.vUnCom)

      // 1) Tenta casar pelo código do produto (SKU/cProd).
      let existing = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.sku, cProd))
        .limit(1)

      // 2) Se não achou, tenta pelo código de barras.
      if (existing.length === 0 && barcode) {
        existing = await db
          .select({ id: products.id })
          .from(products)
          .where(eq(products.barcode, barcode))
          .limit(1)
      }

      if (existing.length > 0) {
        // Produto já existe: apenas incrementa o estoque.
        await db
          .update(products)
          .set({
            quantity: sql`${products.quantity} + ${qCom}`,
            barcode: barcode ?? sql`${products.barcode}`,
            updatedAt: new Date(),
          })
          .where(eq(products.id, existing[0].id))
        updatedList.push(`${cProd}: +${qCom}`)
      } else {
        // Produto não cadastrado: cria automaticamente com os dados do XML.
        await db.insert(products).values({
          sku: cProd,
          barcode,
          title,
          price: String(price),
          quantity: qCom,
          raw: prod as unknown,
        })
        createdList.push(`${cProd} (${title ?? "sem nome"}): ${qCom} un.`)
      }
    }

    revalidatePath("/")
    const details: string[] = []
    if (createdList.length > 0) {
      details.push(`Novos produtos criados a partir do XML: ${createdList.join(" | ")}`)
    }
    return {
      ok: true,
      message: `${updatedList.length} produto(s) atualizado(s), ${createdList.length} criado(s).`,
      details: details.length > 0 ? details : undefined,
    }
  } catch (err) {
    console.log("[v0] importNfeXml error:", err instanceof Error ? err.message : err)
    return { ok: false, message: "Erro ao ler o XML da NF-e." }
  }
}

// Ajuste manual de estoque de um produto.
export async function updateStock(id: number, quantity: number): Promise<ActionResult> {
  const q = Math.max(0, Math.trunc(quantity))
  await db.update(products).set({ quantity: q, updatedAt: new Date() }).where(eq(products.id, id))
  revalidatePath("/")
  return { ok: true, message: "Estoque atualizado." }
}
