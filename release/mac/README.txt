LUX MANAGEMENT FOR MAC
======================

INSTALL
1. Drag Lux Management into the Applications folder (shown next to it in this window).
2. Open Lux Management from Applications or Launchpad.
3. The first time, macOS says it cannot check the app for malicious software,
   because the app is not notarized by Apple. To open it anyway:
   - macOS 15 (Sequoia) and later: click Done, open System Settings > Privacy &
     Security, scroll down, click "Open Anyway" next to Lux Management and confirm.
   - Earlier versions: Control-click Lux Management in Applications, choose Open,
     then click Open again.
   You only do this once.
4. Type your name. Everything you log and change is recorded under that name.

Requires macOS {minimum_macos} or later, on an Intel or Apple Silicon Mac.

WHERE EVERYTHING IS KEPT
The app itself never changes. Everything Lux keeps is in this folder:
  ~/Library/Application Support/Lux Management
To open it in Finder, choose Go > Go to Folder and paste that line.
Settings in Lux also has buttons that open these folders.
  resources.neu          The program's screens, fonts, logo and code.
                         Updates replace this file.
  data/                  ALL workspace records. One file per model, employee,
                         account, task, meeting, library page, weekly posting
                         log and audit log.
                         data/Library files/ holds the PDFs, Word documents,
                         spreadsheets and Markdown files added in
                         Library > Files, in one folder per platform.
  config/                This Mac's settings: who is using it, language,
                         where the data folder is.
  backups/               Automatic full backups, one a day, last 14 kept.
  exports/               Default place for CSVs, briefings and other exports.
  versions/              The last 10 program versions used on this Mac, for
                         going back if an update causes problems.
  Recover Lux.command    Recovery tool, created when Lux first starts (see below).
Deleting or replacing the app never touches this folder. Nothing is saved
anywhere else on the Mac, and the app never sends your data over the internet.
It only asks GitHub whether a new version of the program exists.

SHARING WITH THE TEAM
The app works alone on one Mac. To share one workspace between several
computers (Macs and Windows computers can share the same one):
1. On one computer, open Settings > Data folder > Change folder, and pick a folder
   inside Google Drive for desktop, Dropbox or OneDrive that is shared with the
   team. Your data is copied there.
2. On every other computer, install the app, open Settings > Change folder, pick
   the same synced folder and choose "Use the data there".
Changes from other computers appear within about 15 seconds after the sync
service delivers them. If two people edit the same record at the same moment,
the last save wins; both edits stay in the audit log.

SECURITY
- The data files are plain text. Keep them on a Mac with its own user account
  and FileVault turned on (System Settings > Privacy & Security > FileVault).
- Anyone who can open the data folder can read and change the workspace. Share
  the synced folder only with team members, and remove people when they leave.
- Passwords are never stored. Keep them in a password manager.
- Backups contain everything. Treat the backups folder like the data folder.

UPDATES
Updates only replace resources.neu in the folder above. The app, your data,
settings and backups are never touched, so macOS does not ask again.
- Getting an update: when a new version is published on GitHub, or placed in the
  "Lux updates" folder inside the data folder, a gold bar offers it. Click
  "Install and restart". Lux checks when it opens and every 30 minutes, or use
  Settings > Program updates > Check for updates.
- GitHub: the repository is private, so Lux needs a read-only access token to
  see it. The owner adds it once in Settings > Program updates > GitHub access;
  every computer that uses the same data folder then gets updates from GitHub.
- Only updates signed with the agency's signing key are accepted. A changed or
  forged update file is ignored.
- Going back (Settings > Version history):
  "Go back to this version" switches only this Mac.
  "Rewind everyone" (needs the signing key) withdraws the broken version and asks
  every computer on the shared data folder to go back. To move forward later,
  publish a fixed version with a higher number.
  Your data is never changed by switching versions.
- If Lux won't open at all: quit it, then in Finder choose Go > Go to Folder,
  paste ~/Library/Application Support/Lux Management, double-click
  "Recover Lux.command", type the number of a version and press Enter.

MOVING TO A NEW MAC
Install the app on the new Mac, then copy the folder
~/Library/Application Support/Lux Management from the old Mac to the same place.
Or, on the new Mac, use Settings > Restore a backup with a file from the backups
folder.


LUX MANAGEMENT PARA MAC
=======================

INSTALAR
1. Arraste o Lux Management para a pasta Aplicativos (ao lado dele nesta janela).
2. Abra o Lux Management pelos Aplicativos ou pelo Launchpad.
3. Na primeira vez, o macOS diz que não pode verificar se o app contém software
   malicioso, porque o app não é notarizado pela Apple. Para abrir mesmo assim:
   - macOS 15 (Sequoia) ou mais novo: clique em OK, abra Ajustes do Sistema >
     Privacidade e Segurança, role para baixo, clique em "Abrir Mesmo Assim" ao
     lado de Lux Management e confirme.
   - Versões anteriores: clique no Lux Management em Aplicativos com a tecla
     Control pressionada, escolha Abrir e clique em Abrir de novo.
   Você só faz isso uma vez.
4. Digite seu nome. Tudo o que você registrar e alterar fica gravado com esse nome.

Requer macOS {minimum_macos} ou mais novo, em Mac Intel ou Apple Silicon.

ONDE FICA TUDO
O app em si nunca muda. Tudo o que o Lux guarda fica nesta pasta:
  ~/Library/Application Support/Lux Management
Para abri-la no Finder, escolha Ir > Ir para a Pasta e cole essa linha.
As Configurações do Lux também têm botões que abrem essas pastas.
  resources.neu          Telas, fontes, logo e código do programa.
                         As atualizações substituem este arquivo.
  data/                  TODOS os registros do espaço. Um arquivo por modelo,
                         funcionário, conta, tarefa, reunião, página da
                         biblioteca, registro semanal de postagens e registro
                         de auditoria.
                         data/Library files/ guarda os PDFs, documentos do Word,
                         planilhas e arquivos Markdown adicionados em
                         Biblioteca > Arquivos, com uma pasta por plataforma.
  config/                Configurações deste Mac: quem está usando, idioma,
                         onde fica a pasta de dados.
  backups/               Backups completos automáticos, um por dia, os 14 mais
                         recentes.
  exports/               Local padrão para CSVs, briefings e outras exportações.
  versions/              As 10 últimas versões do programa usadas neste Mac,
                         para voltar se uma atualização der problema.
  Recover Lux.command    Ferramenta de recuperação, criada quando o Lux abre pela
                         primeira vez (veja abaixo).
Apagar ou substituir o app nunca mexe nesta pasta. Nada é salvo em outro lugar
do Mac, e o app nunca envia seus dados pela internet. Ele só pergunta ao GitHub
se existe uma versão nova do programa.

COMPARTILHAR COM A EQUIPE
O app funciona sozinho em um Mac. Para compartilhar um mesmo espaço entre vários
computadores (Macs e computadores com Windows podem usar o mesmo espaço):
1. Em um computador, abra Configurações > Pasta de dados > Trocar pasta e escolha
   uma pasta dentro do Google Drive para desktop, Dropbox ou OneDrive
   compartilhada com a equipe. Seus dados são copiados para lá.
2. Em cada um dos outros computadores, instale o app, abra Configurações >
   Trocar pasta, escolha a mesma pasta sincronizada e clique em "Usar os dados
   de lá".
As alterações de outros computadores aparecem em cerca de 15 segundos depois
que o serviço de sincronização as entrega. Se duas pessoas editarem o mesmo
registro ao mesmo tempo, vale o último salvamento; as duas edições ficam no
registro de auditoria.

SEGURANÇA
- Os arquivos de dados são texto simples. Mantenha-os em um Mac com conta de
  usuário própria e o FileVault ativado (Ajustes do Sistema > Privacidade e
  Segurança > FileVault).
- Quem consegue abrir a pasta de dados pode ler e alterar o espaço. Compartilhe
  a pasta sincronizada apenas com a equipe e remova quem sair.
- Senhas nunca são armazenadas. Guarde-as em um gerenciador de senhas.
- Os backups contêm tudo. Trate a pasta de backups como a pasta de dados.

ATUALIZAÇÕES
As atualizações só substituem o resources.neu na pasta acima. O app, seus dados,
configurações e backups nunca são alterados, então o macOS não pergunta de novo.
- Receber uma atualização: quando uma nova versão é publicada no GitHub ou
  colocada na pasta "Lux updates", dentro da pasta de dados, uma barra dourada a
  oferece. Clique em "Instalar e reiniciar". O Lux verifica ao abrir e a cada 30
  minutos, ou use Configurações > Atualizações do programa > Procurar
  atualizações.
- GitHub: o repositório é privado, então o Lux precisa de um token de acesso
  somente leitura para vê-lo. O dono o adiciona uma vez em Configurações >
  Atualizações do programa > Acesso ao GitHub; todos os computadores que usam a
  mesma pasta de dados passam a receber as atualizações do GitHub.
- Só são aceitas atualizações assinadas com a chave de assinatura da agência.
  Um arquivo alterado ou falsificado é ignorado.
- Voltar (Configurações > Histórico de versões):
  "Voltar para esta versão" muda só este Mac.
  "Voltar todos" (precisa da chave de assinatura) retira a versão com problema e
  pede para todos os computadores da pasta de dados compartilhada voltarem. Para
  avançar depois, publique uma versão corrigida com número maior.
  Trocar de versão nunca altera seus dados.
- Se o Lux não abrir de jeito nenhum: encerre-o, depois no Finder escolha Ir >
  Ir para a Pasta, cole ~/Library/Application Support/Lux Management, clique duas
  vezes em "Recover Lux.command", digite o número de uma versão e pressione Enter.

MUDAR DE MAC
Instale o app no Mac novo e copie a pasta
~/Library/Application Support/Lux Management do Mac antigo para o mesmo lugar.
Ou, no Mac novo, use Configurações > Restaurar um backup com um arquivo da pasta
de backups.
