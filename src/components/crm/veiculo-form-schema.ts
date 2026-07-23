import type { z } from "zod";
import type { veiculoSchema } from "@/lib/validators/veiculo.schema";

export type VeiculoFormValues = z.input<typeof veiculoSchema>;
export type VeiculoFormOutput = z.output<typeof veiculoSchema>;

export const veiculoDefaultValues: VeiculoFormValues = {
  placa: "",
  marca: "",
  modelo: "",
  ano: "",
  cor: "",
  quilometragem: "",
  notas: "",
};
