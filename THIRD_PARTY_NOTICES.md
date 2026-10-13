# Software de terceiros

O código do Aurora e o pacote local `aurora-core` usam MIT, conforme
[LICENSE](LICENSE). Os componentes abaixo mantêm suas próprias licenças.

| Componente | Licença e origem |
| --- | --- |
| Electron | MIT; Chromium e demais componentes têm licenças próprias, incluídas pelo Electron no instalador. [Código](https://github.com/electron/electron) |
| yt-dlp | Código principal sob Unlicense; o executável Windows contém componentes de terceiros sob outras licenças. [Licenças](https://github.com/yt-dlp/yt-dlp/blob/2026.08.19/THIRD_PARTY_LICENSES.txt) |
| FFmpeg e FFprobe | Build GPLv3 do BtbN, executado como programa separado. [Licença incluída](third-party/ffmpeg/LICENSE.txt) |
| React, Zustand, Framer Motion, Radix Slider, NumberFlow e outras bibliotecas | Licenças originais preservadas em `third-party/npm/`; versões registradas nos lockfiles |
| Lucide | ISC. Avisos originais preservados em `third-party/npm/` |

## FFmpeg distribuído

O release usa `8.1.3-18-g46d899d7a0`, compilado pelo BtbN para Windows x64.
FFmpeg e FFprobe vêm do mesmo arquivo. O projeto não altera esses binários.

- [Arquivo original e checksum](https://github.com/BtbN/FFmpeg-Builds/releases/tag/autobuild-2026-10-12-13-12).
- [Código correspondente do FFmpeg](https://github.com/FFmpeg/FFmpeg/tree/46d899d7a0).
- [Receitas e fontes das dependências do build](https://github.com/BtbN/FFmpeg-Builds/tree/autobuild-2026-10-12-13-12).

`resources/binaries.json` registra os arquivos e seus SHA-256.
`prepare:binaries` preserva o texto da licença recebido com o build.
Os avisos desta pasta também acompanham o instalador.
O release inclui arquivos de código-fonte do FFmpeg e yt-dlp e as receitas
do build BtbN, além dos links para suas dependências.

## Dependências JavaScript

`third-party/npm/packages.json` lista os pacotes de produção do processo
principal e do renderer. As subpastas preservam os arquivos de licença
encontrados nos pacotes instalados. Os lockfiles registram as versões e
a integridade das dependências usadas para reconstruir o aplicativo.

Quem redistribuir o instalador precisa preservar os avisos e cumprir as
licenças dos componentes distribuídos, incluindo a disponibilização do
código correspondente exigida pela GPL. A licença MIT do Aurora cobre
apenas o código original do projeto.
