import { getProducts, importMlSheet, importNfeXml } from "@/app/actions/estoque"
import { ImportCard } from "@/components/import-card"
import { StockTable } from "@/components/stock-table"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function Page() {
  const products = await getProducts()

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-balance">Controle de Estoque - Mercado Livre</h1>
        <p className="text-sm text-muted-foreground text-pretty">
          Importe a planilha do ML, dê entrada de mercadoria pelo XML da nota fiscal e exporte a planilha
          atualizada para subir de volta no Mercado Livre.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <ImportCard
          title="1. Importar planilha do Mercado Livre"
          description="Envie o arquivo .xlsx exportado do ML. Ele cria/atualiza os produtos e serve de base para a exportação."
          accept=".xlsx"
          buttonLabel="Importar planilha"
          action={importMlSheet}
        />
        <ImportCard
          title="2. Dar entrada por XML da NF-e"
          description="Envie o XML da nota fiscal de compra. Casa pelo código do produto e depois pelo código de barras; produtos novos são cadastrados automaticamente."
          accept=".xml,text/xml"
          buttonLabel="Importar XML"
          action={importNfeXml}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Estoque</h2>
          <Button asChild variant="default">
            <a href="/api/export">
              <Download className="mr-2 size-4" />
              Exportar planilha do ML
            </a>
          </Button>
        </div>
        <StockTable products={products} />
      </section>
    </main>
  )
}
