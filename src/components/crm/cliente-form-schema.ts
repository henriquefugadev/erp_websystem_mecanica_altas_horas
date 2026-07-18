import type { z } from "zod";
import type { clienteSchema } from "@/lib/validators/cliente.schema";

// clienteSchema termina com .transform(); o formulário trabalha com o
// formato de entrada (pré-transform) e o resolver produz o formato de
// saída — react-hook-form suporta isso via o 3º genérico de useForm.
export type ClienteFormValues = z.input<typeof clienteSchema>;
export type ClienteFormOutput = z.output<typeof clienteSchema>;

export const clienteDefaultValues: ClienteFormValues = {
  tipo: "PF",
  nome: "",
  documento: "",
  telefone: "",
  email: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  origem: "",
  notas: "",
  consenteEmail: false,
  consenteSms: false,
};
