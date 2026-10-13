# Auditoria de segurança do Aurora Desktop

Revisão de 12 de outubro de 2026, para a versão 0.10.1. O trabalho cobriu
o código do aplicativo e do pacote `aurora-core`, a interface nos sete
idiomas, dependências npm, binários de mídia, armazenamento, importações,
comandos IPC, configurações Electron, testes e conteúdo destinado ao GitHub.

A análise combinou leitura do código, testes de entradas maliciosas,
execução do aplicativo, auditoria de dependências e busca de credenciais.
Ela não equivale a uma certificação de segurança nem cobre toda combinação
de mídia, extrator, sistema operacional ou falha futura de terceiros.

## Falhas encontradas e corrigidas

| Severidade estimada | Problema | Correção e evidência |
| --- | --- | --- |
| Alta | `avatarFileName` importado era usado em `path.join` sem restringir o nome. Um perfil podia gravar fora de `Profile`. | Nomes limitados a `avatar.png`, `avatar.jpg`, `avatar.jpeg` ou `avatar.webp`, validação do perfil, assinatura da imagem, base64 e tamanho. Testes unitários e IPC real rejeitam traversal e extensões executáveis. |
| Alta | As rotas IPC não conferiam a janela, o documento nem o frame de origem. O preload completo também era carregado no mini player. | `windowSecurity.js` registra os documentos autorizados e verifica `sender`, `senderFrame` e papel da janela. O mini player só envia seus comandos e logs; frames filhos e documentos remotos são rejeitados. |
| Alta | `width` e `fps` do editor podiam introduzir texto no filtro do FFmpeg. Outras opções não tinham domínio definido. | Validação numérica e listas de formatos e presets antes do processo. FFmpeg e FFprobe do editor aceitam apenas `file,pipe`. Testes unitários e no aplicativo rejeitam filtros injetados. |
| Alta | A política da sessão não restringia explicitamente requisições a arquivos locais. | A interface carrega somente arquivos públicos do app, o avatar validado e mídia autorizada. Teste real bloqueia `file:///C:/Windows/win.ini`. |
| Média | A sessão usava permissões padrão do Electron; a janela de abertura não tinha CSP explícita. | Permissões negadas por padrão, com leitura da área de transferência permitida na janela principal. CSP adicionada à abertura e reforçada nas duas páginas. Script da abertura movido para arquivo externo. |
| Média | Perfis e playlists importados não tinham limite de leitura. Estruturas de playlists gravadas no disco também tinham validação insuficiente. | Perfis e playlists limitados a 8 MB, imagens a 5 MB e playlists a 10.000 faixas. Leitura de playlists rejeita estruturas inválidas e links simbólicos; operações exigem nomes de arquivo locais. |
| Média | O yt-dlp podia carregar configuração e plugins externos. | Análise e download usam `--ignore-config` e `--no-plugin-dirs`, além de argumentos separados e `--` antes do link. |
| Média | O parser de URL aceitava variantes de localhost com ponto final e alguns endereços reservados. | Validação normaliza o host e rejeita essas formas, loopback numérico/hexadecimal, hosts sem domínio e IPv6. Miniaturas são limitadas a HTTPS. |
| Média | FFprobe distribuído era 4.0.2, de 2018; FFmpeg era 6.1.1. | Ambos substituídos pelo build BtbN `8.1.3-18-g46d899d7a0`, com origem imutável e checksum no manifesto. yt-dlp incluído: `2026.08.19`. |
| Média | O renderer tinha oito alertas npm, seis altos e dois médios; a instalação independente do desktop revelou oito alertas médios de ferramentas de build. | Tailwind migrado para 4, `source-map-js` atualizado e `global-agent` atualizado por override. Auditoria final dos dois lockfiles: zero alertas conhecidos. |
| Baixa | Inspeção de mídia podia acumular saída e esperar indefinidamente. | FFprobe tem timeout de 30 segundos, limite de 4 MiB e stderr limitado. |
| Baixa | Exportações simultâneas podiam escolher o mesmo nome antes de gravar. | O arquivo de saída é reservado com abertura exclusiva; nomes existentes recebem um contador. |
| Baixa | Atualizações simultâneas do yt-dlp podiam disputar temporários e backup. | Chamadas de atualização compartilham uma operação em andamento. URLs de atualização também rejeitam credenciais embutidas. |
| Baixa | O executável mantinha os fuses padrão que permitem execução como Node e opções de inspeção. | O empacotamento desativa `RunAsNode`, `NODE_OPTIONS` e argumentos de inspeção Node, exige `app.asar` e ativa sua validação de integridade. |

As severidades refletem o impacto possível neste aplicativo. Falhas que
dependem de um renderer comprometido não pressupõem que exista uma XSS
explorável na interface. A importação de perfil malicioso era uma entrada
externa direta e recebeu prioridade.

## Proteções conferidas

- Todas as janelas têm `contextIsolation`, sandbox e Node desativado.
- Navegação, novas janelas e anexação de webviews são bloqueadas.
- O renderer usa texto React; a leitura do código original não identificou
  uma inserção ativa de HTML arbitrário para metadados.
- A ponte expõe funções nomeadas e não devolve objetos de evento IPC.
- URLs de mídia são HTTP(S), sem credenciais, flags ou endereços locais explícitos.
- A pasta de download recebida por IPC precisa corresponder à escolha das configurações.
- Abrir caminhos pelo shell limita-se às pastas e arquivos de mídia autorizados.
- O protocolo de mídia e as rotas de inspeção/exportação exigem arquivos ativos da biblioteca.
- O protocolo próprio exige host `local`, métodos GET/HEAD e responde 416 para ranges inválidos.
- yt-dlp e FFmpeg são executados sem shell e com argumentos separados.
- Atualizações do yt-dlp usam HTTPS, redirecionamentos limitados, SHA-256,
  temporário e restauração do executável anterior se a troca falhar.
- Biblioteca corrompida é preservada; gravação usa temporário e backup recuperável.
- O logger mascara argumentos, URLs e campos de credenciais e limita registros e rotação.
- Discord Rich Presence começa desativado em instalações novas.
- Os testes de interface usam mídia e dados próprios, sem alterar a biblioteca pessoal.

## Publicação e organização

O Desktop não tinha histórico Git próprio e dependia do monorepo. O código
de `aurora-core` foi incluído em `vendor/aurora-core`, com licença MIT,
dependência local e lockfile independente. FFmpeg e FFprobe deixaram de
depender dos pacotes estáticos antigos. `prepare:binaries` confere os
arquivos oficiais antes de preparar o build.

Foram removidos `SESSAO.md`, `REDESIGN_FRONTEND.md` e `AUDITORIA_TECNICA.md`.
Eram relatos de trabalho ou resultados antigos, com caminhos particulares
e instruções que já não descreviam a versão publicada. README e arquitetura
foram reescritos para o estado atual. O relatório presente substitui a auditoria antiga.

Componentes da interface sem referências a partir das duas entradas foram
removidos: `NeonButton`, `Table`, `Tooltip` e `WaveBackground`.

O repositório mantém código, testes, imagens e vídeo usados pelo app,
configuração do instalador, lockfiles, documentação, licença, avisos de
terceiros e manifesto de ferramentas. Dependências instaladas, builds,
executáveis, resultados locais, perfis, logs e arquivos de trabalho ficam
fora do Git. Os instaladores são destinados aos releases.

O CI usa ações fixadas por SHA, permissões de leitura e instalação por
`npm ci`. Dependabot foi configurado para npm e GitHub Actions. O relato
privado de vulnerabilidades foi ativado no repositório.

## Revisão dos textos

A skill Humanizer fornecida pelo proprietário foi aplicada à interface e
à documentação. As mensagens nos sete idiomas tiveram revisão de tom,
pontuação e promessas excessivas, preservando chaves e variáveis de tradução.
Textos curtos que já descreviam uma ação foram mantidos.

Algumas correções também alinham os textos ao comportamento: perfil local
em vez de conta; atualização do yt-dlp em vez de garantia sobre todas as
ferramentas; exclusão do registro da biblioteca em vez de sugestão de
remoção do arquivo; cópia sem perda de qualidade sem promessa de tempo
instantâneo. Licenças e avisos legais de terceiros foram preservados.

## Validação

| Verificação | Resultado |
| --- | --- |
| Testes unitários | 22/22 |
| Segurança no aplicativo real | 9/9 |
| Interface, teclado, temas e acessibilidade coberta pelas suítes | 16/16 |
| Editor, arquivos reais conferidos por FFprobe | 21/21 |
| Personalização e persistência | 12/12 |
| Mini player, comandos e espectro | 30/30 |
| Total de testes de ponta a ponta | 88/88 |
| Playlist real do Internet Archive | 10 itens baixados, numerados e registrados; nenhum ignorado |
| Build de produção do renderer | Aprovado |
| Sintaxe dos módulos main, preload, core e preparação | 32 arquivos aprovados |
| `npm audit`, desktop e renderer | Zero alertas conhecidos em ambos |
| Gitleaks no conteúdo destinado à publicação | Nenhum segredo encontrado |
| Instalador NSIS Windows x64 | Gerado com Electron 44.7.0 e electron-builder 26.17.0 |
| Conteúdo inicial do `app.asar` | Core incluído; pacotes de build e o pacote mobile ausentes |
| Instalação independente do monorepo | `npm ci`, auditorias, 22 testes unitários e 88 testes de interface aprovados |

O runner pode manter dados de teste em `output/` quando o Windows negar a
limpeza de um arquivo ocupado. São dados gerados, ignorados pelo Git; essa
condição é informada pelo runner e não altera a biblioteca pessoal.

## Riscos restantes e limites

1. O instalador não tem assinatura Authenticode. SHA-256 confere integridade
   em relação ao arquivo publicado, mas não substitui assinatura de código.
2. A validação do link rejeita hosts locais explícitos. Ela não impõe uma
   política de rede sobre todos os DNS, redirecionamentos, manifests e URLs
   derivados dentro do yt-dlp. Uma origem pública maliciosa ainda pode
   direcionar essa ferramenta à rede local. Esse limite é do caminho de
   download; a sessão do renderer possui controles separados.
3. FFmpeg, FFprobe e yt-dlp são processos externos com as permissões do usuário.
   A sandbox do renderer não confina esses processos. Não foi executado fuzzing
   de parsers, análise completa de todos os codecs ou sandbox de sistema para eles.
4. Arquivos e executáveis alterados por outro processo com acesso à mesma
   conta continuam sujeitos a manipulação local. A preparação valida os
   downloads; ela não protege o sistema de um usuário ou processo já comprometido.
5. A interface ainda permite estilos inline, necessários ao React e às animações.
   Scripts inline permanecem bloqueados nas páginas.
6. Há I/O síncrono no processo principal e limites de memória para análise
   de playlists. Bibliotecas grandes e muitas chamadas por uma janela já
   comprometida podem causar indisponibilidade.
7. A revisão não inclui instalação em uma máquina Windows limpa, leitores
   de tela em todos os fluxos, pentest independente ou validação exaustiva
   de plataformas externas. O teste real de rede cobriu uma coleção pública.
8. `npm audit` cobre avisos publicados para pacotes npm; não cobre por si só
   toda vulnerabilidade do Chromium ou dos executáveis de mídia. Atualizações
   de Electron e ferramentas continuam sendo trabalho de manutenção.

## Referências técnicas

- [Recomendações de segurança do Electron](https://www.electronjs.org/docs/latest/tutorial/security).
- [Opções e comportamento do yt-dlp](https://github.com/yt-dlp/yt-dlp#usage-and-options).
- [Migração oficial do Tailwind 4](https://tailwindcss.com/docs/upgrade-guide).
- [Código e releases dos builds FFmpeg](https://github.com/BtbN/FFmpeg-Builds).
- [Licenças distribuídas com o projeto](THIRD_PARTY_NOTICES.md).
