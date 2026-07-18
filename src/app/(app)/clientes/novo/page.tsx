import { NovoClienteForm } from "./novo-cliente-form";

export default function NovoClientePage() {
  return (
    <div className="grid max-w-2xl gap-6">
      <h1 className="font-heading text-2xl">Novo cliente</h1>
      <NovoClienteForm />
    </div>
  );
}
