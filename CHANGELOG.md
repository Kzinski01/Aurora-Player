# Histórico de versões

## 0.10.1

- Corrigida a importação de perfis que permitia escrever arquivos fora da pasta de perfil.
- Comandos IPC passaram a validar a janela, o documento e o frame de origem.
- Adicionada validação das opções de corte e conversão; FFmpeg e FFprobe do editor ficam restritos a arquivos locais.
- Limitados os arquivos locais e as permissões acessíveis pela interface.
- Protegida a leitura de playlists contra arquivos excessivos, links simbólicos e estruturas inválidas.
- Atualizadas as dependências e os binários de mídia; downloads de ferramentas têm SHA-256 registrado.
- Revisados os textos da interface nos sete idiomas e a documentação.
- Preparado o projeto para instalação independente do monorepo, com `aurora-core` incluído.
- Publicado o código sob MIT, com avisos separados para software de terceiros.
- Testes de interface agora usam dados temporários em vez da biblioteca pessoal.
