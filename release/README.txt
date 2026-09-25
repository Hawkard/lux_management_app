LUX MANAGEMENT DESKTOP APP (Windows)
=======================================

START
1. Unzip this folder somewhere you control, for example Documents\Lux Management.
   Do not run it from inside the zip file.
2. Double-click LuxManagement.exe.
3. The first time, Windows may show "Windows protected your PC" because the app
   is not signed by a registered publisher. Click "More info", then "Run anyway".
4. Type your name. Everything you log and change is recorded under that name.

Requires Windows 10 or 11 with Microsoft Edge WebView2, which is already
installed on almost every Windows 10 and 11 computer. If the window stays blank,
install "WebView2 Runtime" from Microsoft's website.

WHAT IS IN THIS FOLDER
  LuxManagement.exe   The program.
  resources.neu       The program's screens, fonts, logo and code.
  data\               ALL workspace records. One file per model, employee,
                      account, task, meeting, library page, weekly posting log
                      and audit log.
                      data\Library files\ holds the PDFs, Word documents,
                      spreadsheets and Markdown files added in Library > Files,
                      in one folder per platform.
  config\             This computer's settings: who is using it, language,
                      where the data folder is.
  backups\            Automatic full backups, one a day, last 14 kept.
  exports\            Default place for CSVs, briefings and other exports.
  versions\           The last 10 program versions used on this computer, for
                      going back if an update causes problems.
  Recover Lux.bat     Recovery tool, created when Lux first starts (see below).
The data, config, backups and exports folders are created on first start.
Nothing is saved anywhere else on the computer, and the app never sends your
data over the internet.

SHARING WITH THE TEAM
The app works alone on one computer. To share one workspace between
several computers:
1. On one computer, open Settings > Data folder > Change folder, and pick a folder
   inside Google Drive for desktop, OneDrive or Dropbox that is shared with the team.
   Your data is copied there.
2. On every other computer, unzip the app, open Settings > Change folder, pick the
   same synced folder and choose "Use the data there".
Changes from other computers appear within about 15 seconds after the sync
service delivers them. If two people edit the same record at the same moment,
the last save wins; both edits stay in the audit log.

SECURITY
- The data files are plain text. Keep the folder on a computer with its own
  Windows login and BitLocker (or device encryption) turned on.
- Anyone who can open the data folder can read and change the workspace. Share
  the synced folder only with team members, and remove people when they leave.
- Passwords are never stored. Keep them in a password manager.
- Backups contain everything. Treat the backups folder like the data folder.

UPDATES
Updates only replace resources.neu. The program file, your data, settings and
backups are never touched, and the .exe does not change, so Windows does not warn
again.
- Getting an update: when a new version is placed in the "Lux updates" folder
  inside the data folder, a gold bar offers it. Click "Install and restart".
  Lux checks when it opens and every 30 minutes, or use
  Settings > Program updates > Check for updates.
- Only updates signed with the agency's signing key are accepted. A changed or
  forged update file is ignored.
- Going back (Settings > Version history):
  "Go back to this version" switches only this computer.
  "Rewind everyone" (needs the signing key) withdraws the broken version from
  the shared folder and asks every computer to go back. To move forward later,
  publish a fixed version with a higher number.
  Your data is never changed by switching versions.
- If Lux won't open at all: close it, then double-click "Recover Lux.bat" in
  the program folder, type the number of a version and press Enter.
- Publishing an update (owner only): you receive a new resources.neu. Open
  Settings > Program updates > Publish an update, choose the new resources.neu,
  then choose the signing key file (lux-update-signing-key.json). Everyone using
  the same data folder is offered it. "Save a copy to send" makes a .luxupdate
  file for computers that don't share the folder; they use
  "Install update from file".
- Keep lux-update-signing-key.json secret and backed up, for example in your
  password manager. Never put it in the shared data folder. Anyone with it can
  publish updates; without it, no one can, including you.

MOVING TO A NEW COMPUTER
Copy the whole Lux Management folder. Or on the new computer, use
Settings > Restore a backup with a file from the backups folder.


LUX MANAGEMENT APP PARA DESKTOP (Windows)
===========================================

COMO ABRIR
1. Descompacte esta pasta em um local seu, por exemplo Documentos\Lux Management.
   Não execute de dentro do arquivo zip.
2. Clique duas vezes em LuxManagement.exe.
3. Na primeira vez, o Windows pode mostrar "O Windows protegeu o computador",
   porque o app não é assinado por um editor registrado. Clique em "Mais
   informações" e depois em "Executar assim mesmo".
4. Digite seu nome. Tudo o que você registrar e alterar fica gravado com esse nome.

Requer Windows 10 ou 11 com o Microsoft Edge WebView2, que já vem instalado em
quase todos os computadores com Windows 10 e 11. Se a janela ficar em branco,
instale o "WebView2 Runtime" pelo site da Microsoft.

O QUE HÁ NESTA PASTA
  LuxManagement.exe   O programa.
  resources.neu       Telas, fontes, logo e código do programa.
  data\               TODOS os registros do espaço. Um arquivo por modelo,
                      funcionário, conta, tarefa, reunião, página da biblioteca,
                      registro semanal de postagens e registro de auditoria.
                      data\Library files\ guarda os PDFs, documentos do Word,
                      planilhas e arquivos Markdown adicionados em
                      Biblioteca > Arquivos, com uma pasta por plataforma.
  config\             Configurações deste computador: quem está usando, idioma,
                      onde fica a pasta de dados.
  backups\            Backups completos automáticos, um por dia, os 14 mais
                      recentes.
  exports\            Local padrão para CSVs, briefings e outras exportações.
  versions\           As 10 últimas versões do programa usadas neste
                      computador, para voltar se uma atualização der problema.
  Recover Lux.bat     Ferramenta de recuperação, criada quando o Lux abre pela
                      primeira vez (veja abaixo).
As pastas data, config, backups e exports são criadas na primeira vez que o app
abre. Nada é salvo em outro lugar do computador, e o app nunca envia seus dados
pela internet.

COMPARTILHAR COM A EQUIPE
O app funciona sozinho em um computador. Para compartilhar um mesmo espaço
entre vários computadores:
1. Em um computador, abra Configurações > Pasta de dados > Trocar pasta e
   escolha uma pasta dentro do Google Drive para desktop, OneDrive ou Dropbox
   compartilhada com a equipe. Seus dados são copiados para lá.
2. Em cada um dos outros computadores, descompacte o app, abra Configurações >
   Trocar pasta, escolha a mesma pasta sincronizada e clique em "Usar os dados
   de lá".
As alterações de outros computadores aparecem em cerca de 15 segundos depois
que o serviço de sincronização as entrega. Se duas pessoas editarem o mesmo
registro ao mesmo tempo, vale o último salvamento; as duas edições ficam no
registro de auditoria.

SEGURANÇA
- Os arquivos de dados são texto simples. Mantenha a pasta em um computador com
  login próprio do Windows e BitLocker (ou criptografia do dispositivo) ativado.
- Quem consegue abrir a pasta de dados pode ler e alterar o espaço. Compartilhe
  a pasta sincronizada apenas com a equipe e remova quem sair.
- Senhas nunca são armazenadas. Guarde-as em um gerenciador de senhas.
- Os backups contêm tudo. Trate a pasta de backups como a pasta de dados.

ATUALIZAÇÕES
As atualizações só substituem o resources.neu. O programa, seus dados,
configurações e backups nunca são alterados, e o .exe não muda, então o Windows
não avisa de novo.
- Receber uma atualização: quando uma nova versão é colocada na pasta
  "Lux updates", dentro da pasta de dados, uma barra dourada a oferece. Clique
  em "Instalar e reiniciar". O Lux verifica ao abrir e a cada 30 minutos, ou use
  Configurações > Atualizações do programa > Procurar atualizações.
- Só são aceitas atualizações assinadas com a chave de assinatura da agência.
  Um arquivo alterado ou falsificado é ignorado.
- Voltar (Configurações > Histórico de versões):
  "Voltar para esta versão" muda só este computador.
  "Voltar todos" (precisa da chave de assinatura) retira a versão com problema
  da pasta compartilhada e pede para todos os computadores voltarem. Para
  avançar depois, publique uma versão corrigida com número maior.
  Trocar de versão nunca altera seus dados.
- Se o Lux não abrir de jeito nenhum: feche-o, clique duas vezes em
  "Recover Lux.bat" na pasta do programa, digite o número de uma versão e
  pressione Enter.
- Publicar uma atualização (só o dono): você recebe um novo resources.neu. Abra
  Configurações > Atualizações do programa > Publicar uma atualização, escolha o
  novo resources.neu e depois o arquivo da chave (lux-update-signing-key.json).
  Todos que usam a mesma pasta de dados recebem a atualização. "Salvar uma cópia
  para enviar" gera um arquivo .luxupdate para computadores que não compartilham
  a pasta; eles usam "Instalar atualização de um arquivo".
- Guarde o lux-update-signing-key.json em segredo e com backup, por exemplo no
  seu gerenciador de senhas. Nunca o coloque na pasta de dados compartilhada.
  Quem tiver a chave pode publicar atualizações; sem ela, ninguém pode, nem você.

MUDAR DE COMPUTADOR
Copie a pasta Lux Management inteira. Ou, no computador novo, use
Configurações > Restaurar um backup com um arquivo da pasta de backups.
