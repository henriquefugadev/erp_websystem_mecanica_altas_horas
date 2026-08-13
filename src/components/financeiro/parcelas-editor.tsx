"use client";

import { useState } from "react";
import {
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";
import type { ContaFormValues } from "./conta-form-schema";
import { Erro } from "@/components/ui/erro";
import { centavosParaReais, gerarParcelas, reaisParaCentavos } from "@/modules/financeiro/domain/baixa";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatarDinheiro } from "@/lib/format";

export function ParcelasEditor({
  control,
  register,
  errors,
}: {
  control: Control<ContaFormValues>;
  register: UseFormRegister<ContaFormValues>;
  errors: FieldErrors<ContaFormValues>;
}) {
  const { fields, replace, remove } = useFieldArray({ control, name: "parcelas" });
  const valorTotal = useWatch({ control, name: "valorTotal" });
  const dataEmissao = useWatch({ control, name: "dataEmissao" });
  const parcelasAtuais = useWatch({ control, name: "parcelas" }) ?? [];

  const [numParcelas, setNumParcelas] = useState(1);
  const [intervaloDias, setIntervaloDias] = useState(30);
  const [primeiraVencimento, setPrimeiraVencimento] = useState("");

  function gerar() {
    const total = Number(valorTotal);
    const vencimento = primeiraVencimento || dataEmissao;
    if (!total || total <= 0 || !vencimento || numParcelas <= 0) return;

    const geradas = gerarParcelas(
      reaisParaCentavos(total),
      numParcelas,
      new Date(`${vencimento}T00:00:00Z`),
      intervaloDias
    );

    replace(
      geradas.map((p) => ({
        numero: p.numero,
        valor: centavosParaReais(p.valorCentavos),
        vencimento: p.vencimento.toISOString().slice(0, 10),
      }))
    );
  }

  const somaAtual = parcelasAtuais.reduce((acc, p) => acc + (Number(p?.valor) || 0), 0);
  const diferenca = Math.round(((Number(valorTotal) || 0) - somaAtual) * 100) / 100;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-4 rounded-lg border border-border p-3">
        <div className="grid gap-1.5">
          <Label htmlFor="numParcelas">Nº de parcelas</Label>
          <Input
            id="numParcelas"
            type="number"
            min={1}
            value={numParcelas}
            onChange={(e) => setNumParcelas(Number(e.target.value) || 1)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="primeiraVencimento">1º vencimento</Label>
          <Input
            id="primeiraVencimento"
            type="date"
            value={primeiraVencimento || dataEmissao || ""}
            onChange={(e) => setPrimeiraVencimento(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="intervaloDias">Intervalo entre parcelas (dias)</Label>
          <Input
            id="intervaloDias"
            type="number"
            min={1}
            value={intervaloDias}
            onChange={(e) => setIntervaloDias(Number(e.target.value) || 30)}
          />
        </div>
        <div className="col-span-3">
          <Button type="button" variant="outline" onClick={gerar}>
            Gerar parcelas
          </Button>
        </div>
      </div>

      {fields.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Valor (R$)</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    <input
                      type="hidden"
                      {...register(`parcelas.${index}.numero`, { valueAsNumber: true })}
                    />
                    <Input type="text" inputMode="decimal" {...register(`parcelas.${index}.valor`)} />
                  </TableCell>
                  <TableCell>
                    <Input type="date" {...register(`parcelas.${index}.vencimento`)} />
                  </TableCell>
                  <TableCell>
                    <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                      Remover
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <p className={diferenca !== 0 ? "text-sm text-alert" : "text-sm text-muted-foreground"}>
            Soma das parcelas: {formatarDinheiro(somaAtual)}
            {diferenca !== 0 &&
              ` (diferença de ${formatarDinheiro(diferenca)} em relação ao valor total)`}
          </p>
        </>
      )}

      {/* Erro da lista inteira (ex.: soma das parcelas != total). Os erros por
          linha aparecem em cada campo; aqui `.message` só é string no primeiro
          caso. */}
      {typeof errors.parcelas?.message === "string" && (
        <Erro msg={errors.parcelas.message} />
      )}
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Preencha o valor total e clique em &quot;Gerar parcelas&quot;.
        </p>
      )}
    </div>
  );
}
