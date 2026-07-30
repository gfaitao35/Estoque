import { db } from "@/lib/db"
import { products, appSettings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { read, utils, write } from "xlsx"
import { ML_SHEET_NAME, ML_HEADER_ROWS, COL, cellString } from "@/lib/ml-sheet"

const TEMPLATE_KEY = "ml_template_base64"

export async function GET() {
  // Recupera o template original (planilha oficial importada anteriormente).
  const [setting] = await db.select().from(appSettings).where(eq(appSettings.key, TEMPLATE_KEY))
  if (!setting?.value) {
    return new Response("Nenhum template encontrado. Importe primeiro a planilha oficial do Mercado Livre.", {
      status: 400,
    })
  }

  // Mapa SKU -> estoque atual.
  const all = await db.select().from(products)
  const stockBySku = new Map<string, number>()
  for (const p of all) stockBySku.set(p.sku, p.quantity)

  // Reabre a planilha original e atualiza apenas a coluna de estoque, preservando
  // abas, cabeçalhos e formatação idênticos ao arquivo do Mercado Livre.
  const buffer = Buffer.from(setting.value, "base64")
  const workbook = read(buffer, { cellDates: false, cellStyles: true })
  const sheet = workbook.Sheets[ML_SHEET_NAME]

  const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })
  for (let r = ML_HEADER_ROWS; r < rows.length; r++) {
    const sku = cellString(rows[r]?.[COL.SKU])
    if (!sku) continue
    const stock = stockBySku.get(sku)
    if (stock === undefined) continue
    // Endereço da célula da coluna QUANTITY nesta linha.
    const addr = utils.encode_cell({ r, c: COL.QUANTITY })
    sheet[addr] = { t: "n", v: stock }
  }

  const out = write(workbook, { type: "buffer", bookType: "xlsx" })
  const filename = `estoque-ml-${new Date().toISOString().slice(0, 10)}.xlsx`

  return new Response(out, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
