"use client"

import { useRef, useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import type { ActionResult } from "@/app/actions/estoque"

type Props = {
  title: string
  description: string
  accept: string
  buttonLabel: string
  action: (formData: FormData) => Promise<ActionResult>
}

export function ImportCard({ title, description, accept, buttonLabel, action }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit() {
    const file = inputRef.current?.files?.[0]
    if (!file) {
      toast.error("Selecione um arquivo primeiro.")
      return
    }
    const formData = new FormData()
    formData.append("file", file)

    startTransition(async () => {
      const result = await action(formData)
      if (result.ok) {
        toast.success(result.message, {
          description: result.details?.join(" "),
          duration: 8000,
        })
      } else {
        toast.error(result.message, { description: result.details?.join(" ") })
      }
      if (inputRef.current) inputRef.current.value = ""
      setFileName(null)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
        />
        {fileName && <p className="truncate text-xs text-muted-foreground">{fileName}</p>}
        <Button onClick={handleSubmit} disabled={pending} className="w-full sm:w-auto">
          {pending ? "Processando..." : buttonLabel}
        </Button>
      </CardContent>
    </Card>
  )
}
