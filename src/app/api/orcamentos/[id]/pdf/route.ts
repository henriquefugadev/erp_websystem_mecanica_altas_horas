import { createElement } from "react";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { buscarOrcamentoPorId } from "@/modules/orcamento/data/orcamento.repository";
import { buscarConfiguracao, obterUrlLogo } from "@/modules/workshop/data/workshop.repository";
import { OrcamentoPdf } from "@/modules/orcamento/pdf/orcamento-pdf";

// @react-pdf/renderer usa recursos de Node (fontes, layout Yoga) — precisa do
// runtime Node, não roda em edge.
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autorizado.", { status: 401 });

  const { data: usuario } = await supabase
    .from("usuario")
    .select("nome, email")
    .eq("id", user.id)
    .single();

  const { data: vinculo } = await supabase
    .from("usuario_workshop")
    .select("workshop_id, papel")
    .eq("usuario_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!usuario || !vinculo) return new NextResponse("Não autorizado.", { status: 401 });

  const { id } = await params;

  let orcamento;
  try {
    orcamento = await buscarOrcamentoPorId(supabase, id);
  } catch {
    return new NextResponse("Orçamento não encontrado.", { status: 404 });
  }

  const workshop = await buscarConfiguracao(supabase, vinculo.workshop_id);
  const logoUrl = workshop.logo_path ? await obterUrlLogo(supabase, workshop.logo_path) : null;

  // renderToBuffer() é tipado pra aceitar só um elemento <Document> literal,
  // não um componente wrapper como OrcamentoPdf (cuja raiz É um <Document>)
  // — o cast reflete isso, sem afetar o que roda de verdade.
  const buffer = await renderToBuffer(
    createElement(OrcamentoPdf, { orcamento, workshop, logoUrl }) as Parameters<
      typeof renderToBuffer
    >[0]
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="orcamento-${orcamento.numero}.pdf"`,
    },
  });
}
