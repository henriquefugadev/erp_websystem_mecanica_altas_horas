import { NovaPecaForm } from "./nova-peca-form";

export default function NovaPecaPage() {
  return (
    <div className="grid max-w-2xl gap-6">
      <h1 className="font-heading text-2xl">Nova peça</h1>
      <NovaPecaForm />
    </div>
  );
}
