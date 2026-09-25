# Changelog

Each release needs a `## x.y.z` heading with an `EN:` line and a `PT:` line.
Those two lines become the notes people see in Lux's update bar, in their own language.
The version must match `const APP_VERSION` in `src/lux-management.html`.

## 2.8.1
EN: Import & export now brings a whole workspace over from an older Lux, including the audit log (who changed what, and when) and people's names. Whoever imports picks which person in the backup they are. Long texts are no longer cut short when importing, and exports include the audit log by default. Fixes a rare case where the desktop app could lose entries in a new posting-log week or audit file while checking the data folder for changes.
PT: Importar e exportar agora traz o espaço de trabalho inteiro de um Lux mais antigo, incluindo o registro de auditoria (quem mudou o quê, e quando) e os nomes das pessoas. Quem importa escolhe qual pessoa do backup é. Textos longos não são mais cortados na importação, e as exportações incluem o registro de auditoria por padrão. Corrige um caso raro em que o app de desktop podia perder entradas de uma semana nova do registro de postagens ou de um arquivo novo de auditoria enquanto verificava a pasta de dados.

## 2.8.0
EN: Lux now runs on Mac as well as Windows, and can install updates straight from GitHub (Settings > Program updates). On Mac: an Edit menu for copy and paste, and a recovery tool. Restoring a backup now lists this computer's backups.
PT: O Lux agora roda no Mac, além do Windows, e pode instalar atualizações direto do GitHub (Configurações > Atualizações do programa). No Mac: menu Editar para copiar e colar, e uma ferramenta de recuperação. Restaurar um backup agora mostra a lista de backups deste computador.

## 2.7.1
EN: Fixes imports turning lists (tags, niches, subreddit lists) into text, which broke the Subreddits page and model profiles. Repairs damaged records automatically, restoring lists from backups. New spreadsheet import that matches your columns.
PT: Corrige importações que transformavam listas (tags, nichos, listas de subreddits) em texto e quebravam a página Subreddits e os perfis das modelos. Repara os registros danificados automaticamente, restaurando listas dos backups. Nova importação de planilhas que reconhece suas colunas.

## 2.7.0
EN: Posting log: new Poster field for who made the post, separate from who logs it. Posts are credited to the Poster in totals, filters, team profiles and the AI briefing.
PT: Registro de postagens: novo campo Postador para quem fez o post, separado de quem registra. Os posts contam para o Postador nos totais, filtros, perfis da equipe e no briefing de IA.

## 2.6.0
EN: Posting log: subreddit and post title from the link, manual post time, views and likes/upvotes. New Subreddits tab with tags that suggest subreddits to models. Boss, CEO and Reliever roles. Karma and followers logged separately.
PT: Registro de postagens: subreddit e título pelo link, horário, visualizações e curtidas/upvotes manuais. Nova aba Subreddits com tags que sugerem subreddits às modelos. Funções Chefe, CEO e Folguista. Karma e seguidores separados.

## 2.5.0
EN: Posting log reads post links, stats and subreddit performance.
PT: O registro de postagens lê links de posts, estatísticas e desempenho por subreddit.

## 2.4.0
EN: Models: Reddit, Instagram and TikTok usernames, and a color picker for each model's name.
PT: Modelos: usuários do Reddit, Instagram e TikTok, e um seletor de cor para o nome de cada modelo.

## 2.3.0
EN: Version history in Settings: go back to any earlier version, rewind the whole team, and a recovery tool if Lux won't open.
PT: Histórico de versões nas Configurações: volte para qualquer versão anterior, faça a equipe toda voltar e use a ferramenta de recuperação se o Lux não abrir.

## 2.2.0
EN: Library files: keep PDFs, Word documents, spreadsheets and Markdown files for Reddit, Instagram, TikTok and general use.
PT: Arquivos da biblioteca: guarde PDFs, documentos do Word, planilhas e arquivos Markdown para Reddit, Instagram, TikTok e uso geral.

## 2.1.0
EN: Adds one-click program updates.
PT: Adiciona atualizações do programa com um clique.
