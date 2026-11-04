# Abisso

Aplicação de vida marinha procedural em Three.js, com uma landing page e um editor de aquários na mesma base de código.

## Executar

Requer Node.js 22 ou superior. A aplicação não precisa de build nem de dependências de execução: o Three.js está incluído em `engine/vendor/`, com a respetiva licença.

```sh
npm start
```

Abrir <http://127.0.0.1:4200/>. Para escolher outra porta em PowerShell:

```powershell
$env:PORT = '4201'
npm start
```

## Experiência atual

- A landing inclui estrelas, aurora ocasional, cardume e o cenário submarino que acompanha o scroll.
- Uma palavra, uma imagem ou **find a stranger** gera uma criatura e abre o aquário com **Customize** fechado.
- O editor organiza a personalização em **Creature**, **Aquarium**, **Create** e **Save & Share**.
- **Random** gera outro aquário com uma transição suave; **Feed**, pausa, rotação e zoom controlam a observação.
- Os aquários mantêm a estética pixelizada e iluminação noturna. A vegetação respeita os limites do vidro e o espaço das pedras.
- Criaturas, aquários e coleções podem ser guardados ou importados; o endereço preserva os dados para partilha.
- A assinatura de Bernardo Maia e as contribuições GitHub continuam no fundo da landing.

As cores da fotografia e a seed são extraídas localmente no navegador. A imagem não é enviada para um servidor nem analisada por IA.

Os formatos JSON e a chave local `mare.collection.v1` são mantidos para continuar a abrir os dados existentes. URLs antigos de modos do editor são encaminhados para o aquário atual.

## Organização

- `index.html`, `abisso.js`, `abisso.css`: landing e criação de criaturas.
- `landing-boot.js`: preparação das cenas e saída do carregamento.
- `environment.js`, `environment.css`, `fishing-scrollbar.js`: ambiente e navegação por scroll.
- `controls.css`: controlos partilhados e botões de quatro cantos.
- `engine/index.html`, `engine/sheet.js`, `engine/sheet.css`, `engine/editor-theme.css`: editor atual.
- `engine/tank.js`: renderização e interação com o aquário.
- Restantes módulos de `engine/`: geração, anatomia, movimento, habitats e persistência.
- `assets/`: logótipos e imagem de contribuições.
- `tests/`: testes de genética, anatomia, movimento, limites da decoração, partilha e regressões.
- `scripts/`: verificação do projeto e geração de recursos.
- `server.mjs`: servidor estático de desenvolvimento.

## Formatação e verificações

Instalar as ferramentas de desenvolvimento:

```sh
npm ci
```

```sh
npm run format
npm run check
npm test
```

- `format` aplica o Prettier ao código próprio; exclui o Three.js e os recursos gerados.
- `check` verifica sintaxe JavaScript, referências locais, IDs HTML duplicados, ficheiros do motor sem utilização, formatação e a análise estática do Knip.
- `check:unused` procura ficheiros, exports e referências sem utilização no código de produção; exclui o Three.js e reconhece funções utilizadas dentro do próprio módulo.
- `test` descobre automaticamente `tests/test-*.mjs` e executa-os sequencialmente, incluindo todos os testes mesmo quando algum falha.

A configuração de indentação, UTF-8 e finais de linha está em `.editorconfig` e `.prettierrc.json`.

## Recursos gerados

```sh
npm run generate:logo
npm run update:contributions
```

O primeiro comando recria `assets/abisso.svg`; o segundo atualiza `assets/github-contributions.svg` com as contribuições públicas de gajonormal.

## Atualização diária das contribuições

O workflow `.github/workflows/update-contributions.yml` executa o gerador diariamente às **07:23 UTC** e guarda alterações apenas em `assets/github-contributions.svg`. Também pode ser executado manualmente em **Actions → Update contribution map → Run workflow**.

O agendamento só fica ativo depois de publicar o workflow na branch predefinida do GitHub, com Actions permitido. Usa o token automático do repositório; não precisa de um token pessoal nem de dependências npm. Se a recolha falhar, mantém-se a última imagem válida. O site publicado precisa de receber o ficheiro atualizado pelo seu processo de deploy; a geração do SVG não substitui esse deploy. Os horários do GitHub Actions podem sofrer atrasos.

A nova logo de separador está em `assets/favicon.svg`, partilhada pela landing e pelo editor; o logótipo escrito da página mantém-se em `assets/abisso.svg`.
