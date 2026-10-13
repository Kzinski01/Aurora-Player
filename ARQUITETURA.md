# Arquitetura do Aurora

O processo principal do Electron cuida de janelas, arquivos, configurações
e ferramentas de mídia. A interface React roda no Chromium e usa funções
nomeadas expostas por `contextBridge` em `src/preload/preload.js`.
Todas as janelas usam isolamento de contexto, sandbox e Node desativado.

`vendor/aurora-core` contém regras de fila, playlists, metadados, biblioteca,
perfis e construção dos argumentos do yt-dlp e FFmpeg. Esse pacote recebe
valores e devolve resultados; o acesso ao sistema fica em `src/main`.

## Módulos

| Arquivo ou pasta | Responsabilidade |
| --- | --- |
| `src/main/main.js` | Inicialização, instância única, janelas, bandeja, migrações e handlers IPC |
| `windowSecurity.js` | Associação entre janela e documento; validação da origem dos comandos |
| `sessionSecurity.js` | Política de acesso da interface a arquivos e endereços de rede |
| `downloadManager.js` | Processos yt-dlp, metadados, fila e grupos de playlist |
| `downloadInput.js`, `playlistPlan.js` | Validação de URLs, nomes Windows e plano de download de playlists |
| `mediaEditor.js`, `exportValidation.js` | Inspeção e exportação de cortes com opções validadas |
| `binaries.js` | Localização de executáveis e atualização manual do yt-dlp |
| `libraryStore.js` | Biblioteca, gravação com backup e proteção de dados corrompidos |
| `playlistSync.js` | Arquivos JSON e associação das faixas à biblioteca |
| `profileStore.js`, `profileValidation.js` | Perfil, avatar e importação/exportação |
| `miniPlayer.js`, `tray.js` | Janela compacta, posição e menu de bandeja |
| `discordPresence.js`, `logger.js` | Integração opcional com Discord e logs com dados sensíveis mascarados |
| `src/renderer/src` | Páginas React, componentes, stores Zustand, temas e traduções |
| `scripts/prepare-binaries.cjs` | Download e conferência dos executáveis usados no desenvolvimento e release |

## Inicialização e janelas

`aurora-media://` é registrado antes de `app.ready`, como exige o Electron.
O aplicativo adquire uma trava de instância única. Links `aurora://` e
uma segunda abertura trazem a janela existente para a frente.

A abertura reproduz o vídeo de `assets/intro.mp4` enquanto o renderer
carrega. A janela principal aparece quando ambos terminam, com um limite
de 12 segundos para o vídeo. Fechar a janela principal a oculta e mostra
o mini player. A bandeja permite reabrir a janela ou encerrar o aplicativo.
No encerramento, downloads, análises e exportações são cancelados.

O mini player tem um card de 350 × 108 pixels em uma janela de 370 × 128.
A margem acomoda a sombra. A posição é persistida com debounce e ajustada
aos monitores disponíveis. `showInactive()` evita roubar o foco, e o nível
`normal` de `alwaysOnTop` permite permanecer abaixo de superfícies exclusivas.

## Downloads e conversão

`DownloadQueue` controla a ordem e as transições de estado. O adaptador
`DownloadManager` executa yt-dlp, lê seu progresso e comunica os resultados
à fila. A concorrência aceita inteiros de 1 a 20.

A análise identifica vídeos ou playlists. Uma busca por nome usa
`ytsearch1:`. Downloads individuais usam `--no-playlist`; grupos de
playlist enfileiram itens em sequência e preservam a posição de origem.
`--encoding utf-8` mantém os nomes da saída compatíveis com o disco.
`--ignore-config` e `--no-plugin-dirs` desativam configurações e plugins
externos; `--` separa opções da URL.

Os processos são criados com argumentos separados e sem shell. No Windows,
cancelar yt-dlp encerra também sua árvore de processos. As atualizações
de progresso da interface são limitadas a cerca de dez por segundo.
A fila fica em memória; arquivos `.part` podem ser retomados ao enfileirar
novamente o mesmo download.

O editor inspeciona mídia com FFprobe e monta a exportação com `clipArgs.js`.
Tempo, formato, dimensões, FPS e parâmetros de qualidade são validados
antes de criar o processo. O nome de saída é reservado para impedir que
exportações simultâneas sobrescrevam um resultado. GIF usa duas passagens:
geração de paleta e codificação. A paleta temporária é removida ao terminar.
O progresso do FFmpeg é calculado pela duração do trecho.

FFmpeg e FFprobe do editor aceitam somente os protocolos `file` e `pipe`.
A inspeção tem timeout e limite de resposta. Os downloads do yt-dlp
continuam precisando dos protocolos de rede dos sites de origem.

## Armazenamento

Os caminhos ficam dentro de `app.getPath("userData")`:

| Caminho | Conteúdo |
| --- | --- |
| `config.json` | Preferências do electron-store |
| `Biblioteca/library.json` | Catálogo dos arquivos baixados |
| `Playlists/*.json` | Uma playlist por arquivo |
| `Profile/profile.json` e `avatar.*` | Perfil local e foto |
| `bin/yt-dlp.exe` | Atualização manual, quando instalada |
| `logs/aurora.log` | JSON por linha, com rotação após 5 MB |

Playlists usam `{ id, music_ID }` para faixas associadas à biblioteca.
Faixas pendentes mantêm título, URL e formato. A reconciliação identifica
vídeos pela URL e considera a presença do arquivo no disco; a exportação
inclui os dados necessários para reimportar em outra instalação.

Remover um item marca `removed`; restaurar desfaz essa marca. Excluir
o registro elimina a entrada da biblioteca e preserva o arquivo de mídia.
`fileMissing` é calculado durante a leitura. A biblioteca recusa gravação
quando o JSON existente está corrompido.

Perfis importados aceitam campos definidos, temas conhecidos, cores
hexadecimais e fotos PNG, JPG ou WebP de até 5 MB. O nome da foto precisa
ser `avatar` com uma dessas extensões. Arquivos de perfil e playlists
importados têm limite de 8 MB; playlists aceitam até 10.000 faixas.

## Reprodução e interface

O elemento de áudio ou vídeo pertence à janela principal. O mini player
recebe estado e espectro e envia comandos de reprodução à mesma janela.
`backgroundThrottling: false` mantém os timers ativos durante a reprodução
oculta. Os eventos de visibilidade permitem suspender animações sem parar
o áudio.

O protocolo `aurora-media://local/` serve apenas arquivos ativos da
biblioteca, com suporte a `Range` para seek. Isso permite usar Web Audio
sem a origem opaca de `file://`. Se o protocolo falhar, o player pode
usar a URL de arquivo e desligar o analisador. O espectro publica 72 bandas
a cerca de 30 Hz; o mini player interpola a apresentação até 60 FPS.

O Vite gera `index.html` e `mini.html`. Tailwind 4 e `design-system.css`
definem o tema; a cor de destaque vem do perfil e gera suas variantes
clara e escura. O contraste do texto sobre o destaque é calculado a partir
da cor escolhida. Os dicionários cobrem português, inglês, espanhol,
alemão, japonês, chinês e russo.

A política CSP bloqueia scripts externos, frames, plugins e formulários.
A sessão permite arquivos do aplicativo, o avatar validado e mídia
autorizada. IPC valida documento, janela e frame; o mini player recebe
apenas os comandos de seu papel. Os detalhes da cobertura e os riscos
restantes estão em [AUDITORIA_SEGURANCA.md](AUDITORIA_SEGURANCA.md).
