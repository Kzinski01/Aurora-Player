// Turns yt-dlp's raw (often verbose/technical) stderr into a short message a
// non-technical user can act on, instead of dumping the tool's own wording.
// Pure string→string mapping — identical on desktop and mobile since both
// shell out to the same yt-dlp binary and get the same error vocabulary back.
function friendlyError(raw) {
  const msg = raw || "";
  if (/Unsupported URL|is not a valid URL/i.test(msg)) return "Esse link não é válido ou não é suportado.";
  if (/Video unavailable/i.test(msg)) return "Esse vídeo não está mais disponível.";
  if (/Private video/i.test(msg)) return "Esse vídeo é privado e não pode ser baixado.";
  if (/This video is not available|content isn.t available/i.test(msg)) return "Esse conteúdo não está disponível na sua região ou foi removido.";
  if (/Sign in to confirm you.re not a bot|confirm your age|age-restricted/i.test(msg)) return "O YouTube pediu verificação para esse vídeo (idade ou anti-robô) e não foi possível baixá-lo.";
  if (/HTTP Error 429|Too Many Requests/i.test(msg)) return "Muitas tentativas em pouco tempo. Aguarde um instante e tente novamente.";
  if (/login required|rate-limit reached|checkpoint_required|requested content is not available|Restricted Video/i.test(msg))
    return "Esse conteúdo exige login e não pode ser baixado.";
  if (/this post may not be accessible|unable to extract shared data/i.test(msg)) return "Não foi possível acessar essa postagem do Instagram. Ela pode ser privada.";
  // yt-dlp names the channel before "does not exist", so the older
  // "The channel/user does not exist" wording never actually matched.
  if (/does not exist|channel is not currently live|is offline/i.test(msg)) return "Esse canal não existe ou não está ao vivo no momento.";

  // A malformed address never reaches the network at all.
  if (/no host given|Invalid URL|missing scheme|urlopen error unknown url type/i.test(msg))
    return "Esse link parece incompleto ou digitado errado.";
  // DNS failure vs. a site that simply answered 404 are different problems
  // for the user: one is "check your connection/address", the other is
  // "that page isn't there".
  if (/No address associated with hostname|Name or service not known|nodename nor servname|getaddrinfo|ENOTFOUND|Temporary failure in name resolution/i.test(msg))
    return "Não foi possível encontrar esse endereço. Confira o link e sua conexão.";
  if (/ETIMEDOUT|network is unreachable|timed out|Connection refused|Connection reset/i.test(msg))
    return "Não foi possível acessar esse link. Verifique sua conexão com a internet.";
  if (/HTTP Error 40[0-9]|HTTP Error 5[0-9][0-9]/i.test(msg)) {
    // The "generic" extractor is yt-dlp's last-resort fallback: reaching it
    // means no site-specific support matched, so a 404 there is really
    // "this site isn't supported", not "this video was deleted".
    if (/\[generic\]/i.test(msg)) return "Esse site não é suportado, ou a página não existe mais.";
    return "O servidor recusou o download desse link. Ele pode ter sido removido.";
  }
  if (/\[generic\]/i.test(msg)) return "Esse site não é suportado pelo Aurora.";

  // A live broadcast has no finished file to fetch — the download starts and
  // then the conversion step fails, which reads as a mysterious ffmpeg error
  // unless it's named for what it is.
  if (/is still live|live event will begin|Livestream|m3u8.*live/i.test(msg))
    return "Isso é uma transmissão ao vivo. Só dá para baixar depois que ela terminar.";
  // Conversion failing is a different problem from the link being bad, so it
  // shouldn't fall through to the "link não suportado" wording below.
  if (/ffmpeg|ffprobe/i.test(msg) && /error|exited|failed|código/i.test(msg))
    return "O download funcionou, mas a conversão do arquivo falhou. Tente outro formato ou qualidade.";

  // Last resort: yt-dlp exited non-zero without printing anything usable
  // (some extractors fail silently). "saiu com código 1" tells the user
  // nothing they can act on.
  if (/saiu com código|exited with code|exit code/i.test(msg))
    return "Não foi possível processar esse link. Ele pode não ser suportado, exigir login ou ter sido removido.";

  return msg || "Não foi possível processar esse link.";
}

module.exports = { friendlyError };
