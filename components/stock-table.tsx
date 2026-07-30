"use client"

import { useMemo, useState, useTransition } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { updateStock } from "@/app/actions/estoque"
import type { Product } from "@/lib/db/schema"

export function StockTable({ products }: { products: Product[] }) {
  const [search, setSearch] = useState("")
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [pending, startTransition] = useTransition()
  const [savingId, setSavingId] = useState<number | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) => p.sku.toLowerCase().includes(q) || (p.title ?? "").toLowerCase().includes(q),
    )
  }, [products, search])

  function save(p: Product) {
    const raw = drafts[p.id]
    const value = raw === undefined ? p.quantity : Number.parseInt(raw, 10)
    if (Number.isNaN(value) || value < 0) {
      toast.error("Quantidade inválida.")
      return
    }
    setSavingId(p.id)
    startTransition(async () => {
      const res = await updateStock(p.id, value)
      if (res.ok) toast.success(`${p.sku}: estoque salvo (${value}).`)
      else toast.error(res.message)
      setSavingId(null)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          placeholder="Buscar por SKU ou título..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Badge variant="secondary">{filtered.length} produto(s)</Badge>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">SKU</TableHead>
              <TableHead>Título</TableHead>
              <TableHead className="w-24 text-right">Preço</TableHead>
              <TableHead className="w-40">Estoque</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum produto. Importe a planilha oficial do Mercado Livre para começar.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                  <TableCell className="max-w-md truncate text-sm">{p.title}</TableCell>
                  <TableCell className="text-right text-sm">
                    {p.price ? `R$ ${Number(p.price).toFixed(2)}` : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        className="h-8 w-20"
                        value={drafts[p.id] ?? String(p.quantity)}
                        onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => save(p)}
                        disabled={pending && savingId === p.id}
                      >
                        {pending && savingId === p.id ? "..." : "Salvar"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
