import { Session, waitForTarget } from "./lib/cdp.mjs";
import { createReporter, pickLibraryFiles } from "./lib/harness.mjs";

export default async function run() {
  const { check, summary } = createReporter("Segurança");
  const session = await Session.open(await waitForTarget((target) => target.type === "page" && target.url.includes("index.html")));
  const rejected = async (expression) => session.evaluate(`Promise.resolve().then(() => ${expression}).then(() => false, () => true)`);
  try {
    check("IPC rejeita perfil com avatar fora da pasta", await rejected(`window.aurora.applyProfileImport({version:1,profile:{id:'x',username:'Teste'},avatarFileName:'../config.json',avatarBase64:'YWJj'})`));
    check("IPC rejeita cor com CSS injetado", await rejected(`window.aurora.setProfilePreferences({accentColor:'red; background:url(file:///secret)'})`));
    check("IPC rejeita configuração desconhecida", await rejected(`window.aurora.setSettings({arbitrary:'value'})`));
    check("IPC rejeita execução de arquivo fora dos downloads", await rejected(`window.aurora.openPath('C:\\\\Windows\\\\System32\\\\cmd.exe')`));
    check("IPC rejeita protocolo de mídia fora da biblioteca", await rejected(`window.aurora.toFileUrl('C:\\\\Windows\\\\win.ini')`));
    check("IPC rejeita inspeção de arquivo fora da biblioteca", await rejected(`window.aurora.probeMedia('C:\\\\Windows\\\\win.ini')`));
    const file = JSON.stringify(pickLibraryFiles().video.filePath);
    check("IPC rejeita injeção de filtro no FFmpeg", await rejected(`window.aurora.exportClip({filePath:${file},start:0,end:2,target:'gif',options:{width:'480,movie=secret'}})`));
    check("sessão bloqueia leitura de arquivo local arbitrário", await session.evaluate(`fetch('file:///C:/Windows/win.ini').then(() => false, () => true)`));
    check("sessão bloqueia acesso à rede local", await session.evaluate(`fetch('http://127.0.0.1:9/').then(() => false, () => true)`));
  } finally {
    session.close();
  }
  return summary();
}
