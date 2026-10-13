# Como contribuir

Abra uma issue para relatar um problema ou discutir uma mudança. Para bugs,
informe a versão, o Windows utilizado, os passos e o resultado esperado.
Falhas de segurança devem ser enviadas pelo canal descrito em [SECURITY.md](SECURITY.md).

## Preparar o ambiente

Use Windows x64, Git e Node.js 22.12.0 ou mais recente. O CI usa Node.js 24.

```powershell
git clone https://github.com/Kzinski01/Aurora-Player.git
cd Aurora-Player
npm ci
npm --prefix src/renderer ci
npm run prepare:binaries
npm run build:renderer
npm start
```

`prepare:binaries` baixa e confere as ferramentas de mídia. O pacote
`aurora-core` está incluído em `vendor/`, sem exigir o restante do monorepo.

`npm run dev:renderer` inicia o Vite em `127.0.0.1:5173`. O Electron carrega
`src/renderer/dist`; execute `npm run build:renderer` após alterar a interface.
Para gerar o instalador em `release/`, execute `npm run dist`.

## Verificar uma mudança

Antes de abrir um pull request, execute:

```powershell
npm run test:unit
npm run build:renderer
npm run test:e2e
npm audit
npm --prefix src/renderer audit
```

Os testes de interface usam arquivos temporários e mídia gerada pelo FFmpeg.
Precisam de uma sessão de desktop Windows. O teste opcional
`node tests/integration/live-playlist.cjs` baixa dez vídeos públicos do
Internet Archive, verifica os arquivos e remove os dados temporários.

Mantenha os sete dicionários de idioma com as mesmas chaves. Preserve as
variáveis como `{{count}}` e escreva mensagens que ajudem a pessoa a agir.
Valide novos comandos IPC no processo principal e acrescente testes quando
a mudança afetar permissões, arquivos ou processos externos.

Descreva no pull request o problema resolvido e os testes executados.
As contribuições ao código do Aurora seguem a licença MIT do projeto.
