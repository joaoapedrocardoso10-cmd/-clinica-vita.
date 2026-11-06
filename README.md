# Clínica Vita — Modelo Premium

Plataforma demonstrativa de clínica que reúne site institucional, agendamento online, portal do paciente e painel de gestão. Construída com Next.js, TypeScript, Tailwind CSS e Supabase/PostgreSQL.

## O que inclui

- Site institucional responsivo, formulário de contato e atalhos para WhatsApp.
- Agenda pública que consulta o banco, bloqueia horários ocupados e permite pedidos para datas recorrentes.
- Portal do paciente com cadastro, login, recuperação de senha, perfil, histórico e pedidos de cancelamento/remarcação.
- Painel por perfil: administrador, recepção e profissional, com controle de acesso no servidor e no banco.
- Gestão de agendamentos, pacientes, serviços, profissionais, horários semanais e contas da equipe.
- Relatórios agregados com filtro por período e exportação CSV disponível para a administração.
- Registro das ações administrativas relevantes.

O sistema não armazena prontuários. Dados, nomes de profissionais, preços, endereço, telefones e horários iniciais são demonstrativos e precisam ser trocados antes de usar com uma clínica real.

## Executar localmente

1. Instale as dependências com `npm install`.
2. Copie `.env.example` para `.env.local` e preencha as variáveis necessárias.
3. Configure o Supabase conforme [SUPABASE-SETUP.md](SUPABASE-SETUP.md). Execute as migrações existentes em ordem e, por último, `supabase/migrations/202611060001_premium_patient_portal.sql`.
4. Inicie a aplicação com `npm run dev` e abra `http://localhost:3000`.

Para validar antes de publicar:

```powershell
npm run lint
npm run build
```

## Variáveis

- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` conectam o site ao Supabase. A aplicação ainda aceita o nome antigo `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `NEXT_PUBLIC_SITE_URL` define os links de confirmação e convite.
- `NEXT_PUBLIC_CLINIC_WHATSAPP` define o WhatsApp público da clínica.
- `RESEND_API_KEY`, `CONTACT_TO_EMAIL` e `CONTACT_FROM_EMAIL` habilitam o formulário institucional por e-mail.
- `SUPABASE_SECRET_KEY` é opcional e só serve no servidor para convidar e ativar/desativar funcionários. Nunca adicione o prefixo `NEXT_PUBLIC_`.

Confirmações e lembretes de consultas por e-mail, WhatsApp Business e pagamentos não são enviados automaticamente neste projeto. Só apresente essas funções como ativas depois de configurar e testar os serviços externos correspondentes.

## Publicação

Use a branch `modelo-premium` como produto Premium separado. Configure as variáveis no provedor de hospedagem, execute a migração Premium no Supabase, configure os endereços de retorno do Supabase e teste cadastro, login, agendamento, permissões e solicitações antes de apresentar o sistema a uma clínica.
