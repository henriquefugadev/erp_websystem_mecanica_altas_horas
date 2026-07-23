export type EnderecoPorCep = {
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
};

type RespostaViaCep = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

/** Busca endereço pelo CEP na ViaCEP (gratuita, sem chave). `null` se o CEP não existir ou a busca falhar. */
export async function buscarEnderecoPorCep(
  cepDigitos: string
): Promise<EnderecoPorCep | null> {
  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${cepDigitos}/json/`);
    if (!resposta.ok) return null;

    const dados: RespostaViaCep = await resposta.json();
    if (dados.erro) return null;

    return {
      logradouro: dados.logradouro ?? "",
      bairro: dados.bairro ?? "",
      cidade: dados.localidade ?? "",
      estado: dados.uf ?? "",
    };
  } catch {
    return null;
  }
}
