# Segurança

As correções de segurança são destinadas à versão mais recente do Aurora.
Use o instalador publicado em [Releases](https://github.com/Kzinski01/Aurora-Player/releases).

Se encontrar uma falha, envie os passos para reproduzi-la por
[relato privado de vulnerabilidade](https://github.com/Kzinski01/Aurora-Player/security/advisories/new).
Inclua a versão do aplicativo, a versão do Windows e o impacto observado.
Remova senhas, cookies, links privados e dados pessoais dos arquivos anexados.

O aplicativo executa yt-dlp, FFmpeg e FFprobe com as permissões do usuário.
Arquivos de mídia e perfis importados passam por validação, mas as ferramentas
de terceiros também precisam receber atualizações. Um FFmpeg alternativo deve
vir de uma fonte em que você confia.

O [relatório da auditoria](AUDITORIA_SEGURANCA.md) descreve o que foi
verificado, as correções aplicadas e os limites da análise.
