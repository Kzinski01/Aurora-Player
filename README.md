# Aurora Player

O Aurora é um aplicativo para Windows que baixa vídeos e áudios, organiza
arquivos em uma biblioteca local e reproduz mídia. Também permite cortar
trechos e exportá-los em vídeo, áudio, GIF ou WebP.

O código do Aurora usa a licença MIT. O aplicativo ainda aparece no Windows
como **Aurora Downloader**, para manter a identificação das instalações existentes.

## Instalar

Baixe o instalador `.exe` em [Releases](https://github.com/Kzinski01/Aurora-Player/releases).
Cada release inclui `SHA256SUMS.txt` para conferir o arquivo baixado:

```powershell
Get-FileHash -Algorithm SHA256 '.\Aurora Downloader Setup 0.10.1.exe'
```

O instalador atual é para Windows x64 e inclui yt-dlp, FFmpeg e FFprobe.
Ele ainda não tem assinatura Authenticode.

## Usar

Na aba **Baixar**, cole um link do YouTube, Instagram ou Twitch, ou busque
pelo nome de um vídeo ou música. Confira o resultado, escolha áudio ou
vídeo, ajuste o formato e adicione à fila. O suporte a cada site depende
do yt-dlp e da disponibilidade do conteúdo.

Ao analisar uma playlist, o Aurora mostra o título, a quantidade e uma
prévia dos itens antes da confirmação. Os arquivos são baixados em ordem,
em uma pasta com o nome da playlist e prefixos `001`, `002` etc. O resumo
da fila informa os itens indisponíveis. Links do YouTube com vídeo e
playlist permitem analisar apenas o vídeo atual.

A biblioteca reúne os downloads, favoritos e playlists. Arquivos ausentes
aparecem com um aviso e podem ser baixados novamente. Remover um item ou
excluir seu registro da biblioteca preserva o arquivo no disco. Playlists
podem ser criadas, renomeadas, importadas e exportadas em JSON; o Aurora
também pode baixar as faixas que ainda faltam.

Use a tesoura em um item da biblioteca para abrir o editor. O corte
preciso reprocessa o vídeo; o rápido copia os dados e pode começar em um
quadro-chave anterior. A exportação de áudio mantém o codec original ou
converte para MP3, FLAC, WAV, AAC, Opus ou M4A. GIF e WebP têm opções de
largura e quadros por segundo.

Fechar a janela principal mantém o aplicativo na bandeja, com reprodução
e downloads ativos. O mini player controla a mesma reprodução, incluindo
volume pela janela principal, progresso, faixas, favoritos e modo aleatório.
Para encerrar, escolha **Sair** no menu da bandeja.

O perfil é local. Você pode mudar o nome, a foto e a cor de destaque,
além de exportá-lo em `.auroraProfile`. As configurações oferecem tema
claro, escuro ou do sistema, sete idiomas, pasta de downloads, limite de
1 a 20 downloads simultâneos e um FFmpeg alternativo acompanhado de
`ffprobe.exe` na mesma pasta.

Baixe apenas conteúdo que você tem permissão para usar.

## Dados e rede

Biblioteca, playlists, perfil, preferências e logs ficam na máquina.
Buscas e downloads precisam de internet; a reprodução de arquivos já
baixados funciona sem conexão.

- yt-dlp acessa o site informado. Miniaturas usam HTTPS.
- A verificação manual do yt-dlp consulta o GitHub. Atualizações são
  conferidas por SHA-256 antes da troca do executável.
- Discord Rich Presence começa desativado em instalações novas. Ao ativá-lo,
  você permite compartilhar informações da faixa em reprodução com o Discord.

## Executar a partir do código

Requisitos: Windows x64, Git e Node.js 22.12.0 ou mais recente.
Node.js 24 é usado no CI. O repositório inclui `aurora-core` em `vendor/`;
você pode instalar este projeto sem o restante do monorepo.

```powershell
git clone https://github.com/Kzinski01/Aurora-Player.git
cd Aurora-Player
npm ci
npm --prefix src/renderer ci
npm run prepare:binaries
npm run build:renderer
npm start
```

`prepare:binaries` baixa as versões registradas em `resources/binaries.json`,
confere os checksums e prepara os três executáveis. Eles ficam fora do Git.
O atalho `iniciar.bat` também instala as dependências e prepara o aplicativo.

Para trabalhar na interface, `npm run dev:renderer` inicia o Vite em
`127.0.0.1:5173`. O Electron carrega a compilação de `src/renderer/dist`;
execute `npm run build:renderer` depois de alterar o código para vê-lo no app.

## Testar e gerar o instalador

```powershell
npm run test:unit
npm run test:e2e
npm audit
npm --prefix src/renderer audit
npm run dist
```

Os testes de interface geram mídia e dados em uma pasta própria dentro de
`output/` e tentam removê-la ao terminar. Se o Windows mantiver um arquivo
ocupado, o runner informa a pasta restante. Precisam de uma sessão de desktop Windows.
Você pode executar uma suíte específica com `npm run test:e2e -- editor`.

O teste opcional abaixo baixa dez vídeos públicos do Internet Archive,
verifica os arquivos e a biblioteca, e remove os dados temporários:

```powershell
node tests/integration/live-playlist.cjs
```

O instalador e o aplicativo desempacotado são gerados em `release/`.
Arquivos compilados, dependências, logs, configurações pessoais e
instaladores ficam fora do histórico Git.

## Documentação

- [Arquitetura](ARQUITETURA.md): processos, armazenamento e reprodução.
- [Auditoria de segurança](AUDITORIA_SEGURANCA.md): resultados e limites da revisão.
- [Como contribuir](CONTRIBUTING.md) e [relatar falhas de segurança](SECURITY.md).
- [Histórico de versões](CHANGELOG.md).
- [Licenças de terceiros](THIRD_PARTY_NOTICES.md). A licença MIT do Aurora
  não substitui as licenças de Electron, FFmpeg, yt-dlp e outras dependências.
