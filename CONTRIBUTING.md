# Como contribuir

Abra uma issue para relatar um problema ou discutir uma mudança. Para bugs,
informe a versão, o Windows utilizado, os passos e o resultado esperado.
Falhas de segurança devem ser enviadas pelo canal descrito em [SECURITY.md](SECURITY.md).

Para trabalhar no código, siga a instalação do [README](README.md). Antes de
abrir um pull request, execute:

```powershell
npm run test:unit
npm run build:renderer
npm run test:e2e
npm audit
npm --prefix src/renderer audit
```

Os testes de interface usam arquivos temporários e mídia gerada pelo FFmpeg.
Precisam de uma sessão de desktop Windows. O teste de playlist com rede real
é opcional e está descrito no README.

Mantenha os sete dicionários de idioma com as mesmas chaves. Preserve as
variáveis como `{{count}}` e escreva mensagens que ajudem a pessoa a agir.
Valide novos comandos IPC no processo principal e acrescente testes quando
a mudança afetar permissões, arquivos ou processos externos.

Descreva no pull request o problema resolvido e os testes executados.
As contribuições ao código do Aurora seguem a licença MIT do projeto.
