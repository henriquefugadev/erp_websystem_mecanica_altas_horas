import { NovoFornecedorForm } from "./novo-fornecedor-form";

export default function NovoFornecedorPage() {
  return (
    <div className="grid max-w-2xl gap-6">
      <h1 className="font-heading text-2xl">Novo fornecedor</h1>
      <NovoFornecedorForm />
    </div>
  );
}
